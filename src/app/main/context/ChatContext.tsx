'use client';

import { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from 'react';
import { useQuote, type QuoteData, type ServiceBlock } from './QuoteContext';
import { useSettings } from './SettingsContext';
import { useAuth } from './AuthContext';
import { useTranslation } from './LanguageContext';
import { createClient } from '@/lib/supabase-browser';

export interface ChatAttachment {
    dataUrl: string;
    type: 'photo' | 'doc';
    name: string;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    attachments?: ChatAttachment[];
}

export interface PendingQuoteData {
    mode?: 'replace' | 'append';
    services: Partial<ServiceBlock>[];
    baseValue?: string;
    estimatedTime?: string;
    expirationDate?: string;
    paymentConditions?: string;
}

export interface ChatConversation {
    id: string;
    title: string;
    isPinned: boolean;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
}

export interface SliderPreferences {
    detail: number;   // 0-100
    market: number;   // 0-100
    tone: number;     // 0-100
}

interface ChatContextType {
    messages: ChatMessage[];
    isLoading: boolean;
    error: string | null;
    pendingQuoteData: PendingQuoteData | null;
    sliders: SliderPreferences;
    conversations: ChatConversation[];
    currentConversationId: string | null;
    sendMessage: (text: string, files?: File[]) => Promise<void>;
    applyQuoteData: () => void;
    clearChat: () => void;
    dismissQuoteData: () => void;
    setSliders: (sliders: SliderPreferences) => void;
    loadConversation: (id: string) => Promise<void>;
    deleteConversation: (id: string) => Promise<void>;
    togglePin: (id: string) => Promise<void>;
    renameConversation: (id: string, newTitle: string) => Promise<void>;
    loadConversations: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const DEFAULT_SLIDERS: SliderPreferences = { detail: 50, market: 50, tone: 50 };

export function ChatProvider({ children }: { children: ReactNode }) {
    const { updateQuote, quote } = useQuote();
    const { settings } = useSettings();
    const { user } = useAuth();
    const { t } = useTranslation();
    const supabase = createClient();

    const welcomeMessage = useMemo<ChatMessage>(() => ({
        id: 'welcome',
        role: 'assistant',
        content: t('aiChat.welcomeMessage'),
        timestamp: Date.now(),
    }), [t]);

    const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pendingQuoteData, setPendingQuoteData] = useState<PendingQuoteData | null>(null);
    const [sliders, setSliders] = useState<SliderPreferences>(DEFAULT_SLIDERS);
    const [conversations, setConversations] = useState<ChatConversation[]>([]);
    const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

    // Compress image to max 1024px and quality 0.8
    const compressImage = useCallback((file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const MAX_SIZE = 1024;
                    let { width, height } = img;
                    if (width > MAX_SIZE || height > MAX_SIZE) {
                        const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
                        width = Math.round(width * ratio);
                        height = Math.round(height * ratio);
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d')!;
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.onerror = reject;
                img.src = e.target?.result as string;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }, []);

    const fileToBase64 = useCallback((file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }, []);
    // Sync welcome message when locale changes
    useEffect(() => {
        setMessages(prev => {
            if (prev.length === 1 && prev[0].id.startsWith('welcome')) {
                return [{ ...prev[0], content: t('aiChat.welcomeMessage') }];
            }
            return prev;
        });
    }, [t]);

    // Load slider preferences from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem('quoteflow_ai_sliders');
            if (saved) setSliders(JSON.parse(saved));
        } catch { /* ignore */ }
    }, []);

    // Save slider preferences
    const updateSliders = useCallback((newSliders: SliderPreferences) => {
        setSliders(newSliders);
        try { localStorage.setItem('quoteflow_ai_sliders', JSON.stringify(newSliders)); } catch { /* ignore */ }
    }, []);

    // ── Chat History CRUD ──

    const loadConversations = useCallback(async () => {
        if (!user) return;
        try {
            const { data, error: err } = await supabase
                .from('chat_conversations')
                .select('id, title, is_pinned, created_at, updated_at, messages')
                .eq('user_id', user.id)
                .order('updated_at', { ascending: false });
            if (err) throw err;
            setConversations((data || []).map((c: any) => ({
                id: c.id,
                title: c.title,
                isPinned: c.is_pinned,
                createdAt: c.created_at,
                updatedAt: c.updated_at,
                messageCount: Array.isArray(c.messages) ? c.messages.length : 0,
            })));
        } catch (err) {
            console.error('Failed to load conversations:', err);
        }
    }, [user, supabase]);

    useEffect(() => {
        if (user) loadConversations();
    }, [user, loadConversations]);

    const saveCurrentChat = useCallback(async (msgs: ChatMessage[]) => {
        if (!user || msgs.length <= 1) return; // Don't save empty chats
        const nonWelcome = msgs.filter(m => m.id !== 'welcome' && !m.id.startsWith('welcome-'));
        if (nonWelcome.length === 0) return;

        // Generate title from first user message
        const firstUserMsg = nonWelcome.find(m => m.role === 'user');
        const title = firstUserMsg
            ? firstUserMsg.content.slice(0, 60) + (firstUserMsg.content.length > 60 ? '...' : '')
            : 'New Chat';

        try {
            if (currentConversationId) {
                // Update existing
                await supabase
                    .from('chat_conversations')
                    .update({
                        messages: msgs.map(({ role, content, timestamp }) => ({ role, content, timestamp })),
                        title,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', currentConversationId);
            } else {
                // Create new
                const { data } = await supabase
                    .from('chat_conversations')
                    .insert({
                        user_id: user.id,
                        title,
                        messages: msgs.map(({ role, content, timestamp }) => ({ role, content, timestamp })),
                    })
                    .select('id')
                    .single();
                if (data) setCurrentConversationId(data.id);
            }
            loadConversations();
        } catch (err) {
            console.error('Failed to save chat:', err);
        }
    }, [user, currentConversationId, supabase, loadConversations]);

    const loadConversation = useCallback(async (id: string) => {
        if (!user) return;
        try {
            const { data, error: err } = await supabase
                .from('chat_conversations')
                .select('messages')
                .eq('id', id)
                .single();
            if (err) throw err;
            if (data?.messages && Array.isArray(data.messages)) {
                const loaded: ChatMessage[] = data.messages.map((m: any, i: number) => ({
                    id: `loaded-${i}-${m.timestamp || Date.now()}`,
                    role: m.role,
                    content: m.content,
                    timestamp: m.timestamp || Date.now(),
                }));
                setMessages(loaded.length > 0 ? loaded : [welcomeMessage]);
                setCurrentConversationId(id);
                setPendingQuoteData(null);
                setError(null);
            }
        } catch (err) {
            console.error('Failed to load conversation:', err);
        }
    }, [user, supabase]);

    const deleteConversation = useCallback(async (id: string) => {
        if (!user) return;
        try {
            await supabase.from('chat_conversations').delete().eq('id', id);
            if (currentConversationId === id) {
                setMessages([{ ...welcomeMessage, id: `welcome-${Date.now()}`, timestamp: Date.now() }]);
                setCurrentConversationId(null);
                setPendingQuoteData(null);
            }
            loadConversations();
        } catch (err) {
            console.error('Failed to delete conversation:', err);
        }
    }, [user, supabase, currentConversationId, loadConversations]);

    const togglePin = useCallback(async (id: string) => {
        if (!user) return;
        const conv = conversations.find(c => c.id === id);
        if (!conv) return;
        try {
            await supabase
                .from('chat_conversations')
                .update({ is_pinned: !conv.isPinned })
                .eq('id', id);
            loadConversations();
        } catch (err) {
            console.error('Failed to toggle pin:', err);
        }
    }, [user, supabase, conversations, loadConversations]);

    const renameConversation = useCallback(async (id: string, newTitle: string) => {
        if (!user || !newTitle.trim()) return;
        try {
            await supabase
                .from('chat_conversations')
                .update({ title: newTitle.trim() })
                .eq('id', id);
            loadConversations();
        } catch (err) {
            console.error('Failed to rename conversation:', err);
        }
    }, [user, supabase, loadConversations]);

    // ── Core Chat ──

    const sendMessage = useCallback(async (text: string, files?: File[]) => {
        if ((!text.trim() && (!files || files.length === 0)) || isLoading) return;

        // Process attachments
        let chatAttachments: ChatAttachment[] = [];
        if (files && files.length > 0) {
            chatAttachments = await Promise.all(
                files.map(async (file) => {
                    const isImage = file.type.startsWith('image/');
                    const dataUrl = isImage ? await compressImage(file) : await fileToBase64(file);
                    return {
                        dataUrl,
                        type: (isImage ? 'photo' : 'doc') as 'photo' | 'doc',
                        name: file.name,
                    };
                })
            );
        }

        // Strip internal notepad prefix from displayed message
        const NOTEPAD_PREFIX = /^\[NOTEPAD[^\]]*\]\n\n/;
        const displayText = text.trim().replace(NOTEPAD_PREFIX, '');

        const userMsg: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: displayText || (chatAttachments.length > 0 ? `[${chatAttachments.map(a => a.name).join(', ')}]` : ''),
            timestamp: Date.now(),
            attachments: chatAttachments.length > 0 ? chatAttachments : undefined,
        };

        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setIsLoading(true);
        setError(null);

        try {
            // For API, use original text (with notepad prefix intact) for the last message
            const apiMessages = newMessages
                .filter(m => !m.id.startsWith('welcome'))
                .map(({ role, content }, idx, arr) => {
                    // Replace the last user message content with the full original text
                    if (idx === arr.length - 1 && role === 'user') {
                        return { role, content: text.trim() };
                    }
                    return { role, content };
                });

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: apiMessages,
                    settings: {
                        currency: settings.currency,
                        taxCountry: settings.taxCountry,
                        sliderDetail: sliders.detail,
                        sliderMarket: sliders.market,
                        sliderTone: sliders.tone,
                        customPricing: settings.customPricing || undefined,
                    },
                    attachments: chatAttachments.length > 0 ? chatAttachments : undefined,
                }),
            });

            const data = await res.json();

            // Handle media limit errors with inline chat message
            if (res.status === 403 && data.error === 'media_limit') {
                const limitMsg: ChatMessage = {
                    id: `system-limit-${Date.now()}`,
                    role: 'assistant',
                    content: data.mediaType === 'photo'
                        ? `📷 Limite de fotos atingido (${data.used}/${data.limit} este mês). Faz upgrade do teu plano para enviar mais fotos.`
                        : `📄 Limite de documentos atingido (${data.used}/${data.limit} este mês). Faz upgrade do teu plano para enviar mais documentos.`,
                    timestamp: Date.now(),
                };
                setMessages([...newMessages, limitMsg]);
                setIsLoading(false);
                return;
            }

            if (!res.ok) throw new Error(data.message || data.error || 'Failed to get response');

            const assistantMsg: ChatMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: data.message || 'Something went wrong — please try again.',
                timestamp: Date.now(),
            };

            const allMessages = [...newMessages, assistantMsg];
            setMessages(allMessages);

            if (data.quoteData) setPendingQuoteData(data.quoteData);

            // Auto-save to history
            saveCurrentChat(allMessages);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Something went wrong';
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    }, [messages, settings, sliders, isLoading, saveCurrentChat, compressImage, fileToBase64]);

    const applyQuoteData = useCallback(() => {
        if (!pendingQuoteData) return;

        const newServices: ServiceBlock[] = (pendingQuoteData.services || []).map((svc) => ({
            type: 'service' as const,
            id: crypto.randomUUID(),
            title: svc.title || '',
            description: svc.description || '',
            pricingMode: svc.pricingMode || 'fixed',
            quantity: svc.quantity || '',
            unitPrice: svc.unitPrice || '',
            fixedPrice: svc.fixedPrice || '',
        }));

        const isAppend = pendingQuoteData.mode === 'append';

        const updates: Partial<QuoteData> = {};

        if (newServices.length > 0) {
            if (isAppend) {
                // Append: add new services to existing ones
                updates.services = [...quote.services, ...newServices];
            } else {
                // Replace: swap all services
                updates.services = newServices;
            }
        }

        // For append mode, only update footer fields if explicitly provided
        if (pendingQuoteData.baseValue) {
            if (isAppend && quote.baseValue) {
                // When appending, sum the base values
                const existing = parseFloat(quote.baseValue) || 0;
                const added = parseFloat(pendingQuoteData.baseValue) || 0;
                updates.baseValue = (existing + added).toFixed(2);
            } else {
                updates.baseValue = pendingQuoteData.baseValue;
            }
        }
        if (pendingQuoteData.estimatedTime) updates.estimatedTime = pendingQuoteData.estimatedTime;
        if (pendingQuoteData.expirationDate) updates.expirationDate = pendingQuoteData.expirationDate;
        if (pendingQuoteData.paymentConditions) updates.paymentConditions = pendingQuoteData.paymentConditions;

        updateQuote(updates);
        setPendingQuoteData(null);
    }, [pendingQuoteData, quote.services, quote.baseValue, updateQuote]);

    const dismissQuoteData = useCallback(() => {
        setPendingQuoteData(null);
    }, []);

    const clearChat = useCallback(() => {
        setMessages([{
            ...welcomeMessage,
            id: `welcome-${Date.now()}`,
            timestamp: Date.now(),
        }]);
        setCurrentConversationId(null);
        setPendingQuoteData(null);
        setError(null);
    }, [welcomeMessage]);

    return (
        <ChatContext.Provider
            value={{
                messages,
                isLoading,
                error,
                pendingQuoteData,
                sliders,
                conversations,
                currentConversationId,
                sendMessage,
                applyQuoteData,
                clearChat,
                dismissQuoteData,
                setSliders: updateSliders,
                loadConversation,
                deleteConversation,
                togglePin,
                renameConversation,
                loadConversations,
            }}
        >
            {children}
        </ChatContext.Provider>
    );
}

export function useChat() {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
}

'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useQuote, type QuoteData, type ServiceBlock } from './QuoteContext';
import { useSettings } from './SettingsContext';
import { useAuth } from './AuthContext';
import { createClient } from '@/lib/supabase-browser';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

export interface PendingQuoteData {
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
    sendMessage: (text: string) => Promise<void>;
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

const WELCOME_MESSAGE: ChatMessage = {
    id: 'welcome',
    role: 'assistant',
    content: 'Hey! What are we quoting today? Tell me about the job and I\'ll help you build a professional quote with the right pricing.',
    timestamp: Date.now(),
};

export function ChatProvider({ children }: { children: ReactNode }) {
    const { updateQuote, quote } = useQuote();
    const { settings } = useSettings();
    const { user } = useAuth();
    const supabase = createClient();

    const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pendingQuoteData, setPendingQuoteData] = useState<PendingQuoteData | null>(null);
    const [sliders, setSliders] = useState<SliderPreferences>(DEFAULT_SLIDERS);
    const [conversations, setConversations] = useState<ChatConversation[]>([]);
    const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

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
                setMessages(loaded.length > 0 ? loaded : [WELCOME_MESSAGE]);
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
                setMessages([{ ...WELCOME_MESSAGE, id: `welcome-${Date.now()}`, timestamp: Date.now() }]);
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

    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim() || isLoading) return;

        const userMsg: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: text.trim(),
            timestamp: Date.now(),
        };

        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setIsLoading(true);
        setError(null);

        try {
            const apiMessages = newMessages
                .filter(m => !m.id.startsWith('welcome'))
                .map(({ role, content }) => ({ role, content }));

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
                    },
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || 'Failed to get response');

            const assistantMsg: ChatMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: data.message || 'I\'ve prepared the quote data for you. Click "Fill Quote" to apply it!',
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
    }, [messages, settings, sliders, isLoading, saveCurrentChat]);

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

        const updates: Partial<QuoteData> = {
            services: newServices.length > 0 ? newServices : quote.services,
        };

        if (pendingQuoteData.baseValue) updates.baseValue = pendingQuoteData.baseValue;
        if (pendingQuoteData.estimatedTime) updates.estimatedTime = pendingQuoteData.estimatedTime;
        if (pendingQuoteData.expirationDate) updates.expirationDate = pendingQuoteData.expirationDate;
        if (pendingQuoteData.paymentConditions) updates.paymentConditions = pendingQuoteData.paymentConditions;

        updateQuote(updates);
        setPendingQuoteData(null);
    }, [pendingQuoteData, quote.services, updateQuote]);

    const dismissQuoteData = useCallback(() => {
        setPendingQuoteData(null);
    }, []);

    const clearChat = useCallback(() => {
        setMessages([{
            ...WELCOME_MESSAGE,
            id: `welcome-${Date.now()}`,
            timestamp: Date.now(),
        }]);
        setCurrentConversationId(null);
        setPendingQuoteData(null);
        setError(null);
    }, []);

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

'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useQuote, type QuoteData, type ServiceBlock } from './QuoteContext';
import { useSettings } from './SettingsContext';

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

interface ChatContextType {
    messages: ChatMessage[];
    isLoading: boolean;
    error: string | null;
    pendingQuoteData: PendingQuoteData | null;
    sendMessage: (text: string) => Promise<void>;
    applyQuoteData: () => void;
    clearChat: () => void;
    dismissQuoteData: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const WELCOME_MESSAGE: ChatMessage = {
    id: 'welcome',
    role: 'assistant',
    content: 'Hey! What are we quoting today? Tell me about the job and I\'ll help you build a professional quote with the right pricing.',
    timestamp: Date.now(),
};

export function ChatProvider({ children }: { children: ReactNode }) {
    const { updateQuote, addService, quote } = useQuote();
    const { settings } = useSettings();
    const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pendingQuoteData, setPendingQuoteData] = useState<PendingQuoteData | null>(null);

    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim() || isLoading) return;

        const userMsg: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: text.trim(),
            timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setIsLoading(true);
        setError(null);

        try {
            // Build conversation history for API (exclude welcome, just role+content)
            const apiMessages = [...messages.filter((m) => m.id !== 'welcome'), userMsg].map(
                ({ role, content }) => ({ role, content })
            );

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: apiMessages,
                    settings: {
                        currency: settings.currency,
                        taxCountry: settings.taxCountry,
                    },
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || data.error || 'Failed to get response');
            }

            const assistantMsg: ChatMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: data.message || 'I\'ve prepared the quote data for you. Click "Fill Quote" to apply it!',
                timestamp: Date.now(),
            };

            setMessages((prev) => [...prev, assistantMsg]);

            // If AI returned structured quote data, store it as pending
            if (data.quoteData) {
                setPendingQuoteData(data.quoteData);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Something went wrong';
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    }, [messages, settings, isLoading]);

    const applyQuoteData = useCallback(() => {
        if (!pendingQuoteData) return;

        // Build service blocks from AI data
        const newServices: ServiceBlock[] = (pendingQuoteData.services || []).map((svc) => ({
            id: crypto.randomUUID(),
            title: svc.title || '',
            description: svc.description || '',
            pricingMode: svc.pricingMode || 'fixed',
            quantity: svc.quantity || '',
            unitPrice: svc.unitPrice || '',
            fixedPrice: svc.fixedPrice || '',
        }));

        // Build quote updates
        const updates: Partial<QuoteData> = {
            services: newServices.length > 0 ? newServices : quote.services,
        };

        if (pendingQuoteData.baseValue) updates.baseValue = pendingQuoteData.baseValue;
        if (pendingQuoteData.estimatedTime) updates.estimatedTime = pendingQuoteData.estimatedTime;
        if (pendingQuoteData.expirationDate) updates.expirationDate = pendingQuoteData.expirationDate;
        if (pendingQuoteData.paymentConditions) updates.paymentConditions = pendingQuoteData.paymentConditions;

        updateQuote(updates);
        setPendingQuoteData(null);
    }, [pendingQuoteData, quote.services, updateQuote, addService]);

    const dismissQuoteData = useCallback(() => {
        setPendingQuoteData(null);
    }, []);

    const clearChat = useCallback(() => {
        setMessages([{
            ...WELCOME_MESSAGE,
            id: `welcome-${Date.now()}`,
            timestamp: Date.now(),
        }]);
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
                sendMessage,
                applyQuoteData,
                clearChat,
                dismissQuoteData,
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

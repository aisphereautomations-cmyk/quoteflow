'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { useAuth } from './AuthContext';

export type PricingMode = 'sqm' | 'hour' | 'fixed';

export interface ServiceBlock {
    id: string;
    title: string;
    description: string;
    pricingMode: PricingMode;
    quantity: string;
    unitPrice: string;
    fixedPrice: string;
}

export interface QuoteData {
    services: ServiceBlock[];
    baseValue: string;
    vatOverride: string;
    estimatedTime: string;
    expirationDate: string;
    paymentConditions: string;
}

export interface SavedQuote {
    id: string;
    title: string;
    clientName: string;
    createdAt: string;
    updatedAt: string;
}

interface QuoteContextType {
    quote: QuoteData;
    currentQuoteId: string | null;
    updateQuote: (updates: Partial<QuoteData>) => void;
    addService: () => void;
    removeService: (id: string) => void;
    updateService: (id: string, updates: Partial<ServiceBlock>) => void;
    saveQuote: (clientName?: string, clientEmail?: string, clientWhatsapp?: string, clientServiceTitle?: string) => Promise<void>;
    loadQuote: (id: string) => Promise<void>;
    deleteQuote: (id: string) => Promise<void>;
    newQuote: () => void;
    savedQuotes: SavedQuote[];
    loadSavedQuotes: () => Promise<void>;
    isLoading: boolean;
    isSaving: boolean;
}

function createEmptyService(): ServiceBlock {
    return {
        id: crypto.randomUUID(),
        title: '',
        description: '',
        pricingMode: 'sqm',
        quantity: '',
        unitPrice: '',
        fixedPrice: '',
    };
}

const defaultQuote: QuoteData = {
    services: [createEmptyService()],
    baseValue: '',
    vatOverride: '',
    estimatedTime: '',
    expirationDate: '',
    paymentConditions: '',
};

const QuoteContext = createContext<QuoteContextType | undefined>(undefined);

export function QuoteProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const supabase = createClient();
    const [quote, setQuote] = useState<QuoteData>(defaultQuote);
    const [currentQuoteId, setCurrentQuoteId] = useState<string | null>(null);
    const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Load saved quotes list when user is available
    const loadSavedQuotes = useCallback(async () => {
        if (!user) return;

        try {
            const { data, error } = await supabase
                .from('quotes')
                .select('id, title, client_name, created_at, updated_at')
                .eq('user_id', user.id)
                .order('updated_at', { ascending: false });

            if (error) {
                console.error('Error loading quotes:', error);
                return;
            }

            setSavedQuotes(
                (data || []).map((q) => ({
                    id: q.id,
                    title: q.title || 'Untitled Quote',
                    clientName: q.client_name || '',
                    createdAt: q.created_at,
                    updatedAt: q.updated_at,
                }))
            );
        } catch (err) {
            console.error('Error loading quotes:', err);
        }
    }, [user, supabase]);

    useEffect(() => {
        if (user) {
            loadSavedQuotes();
        }
    }, [user]);

    const updateQuote = (updates: Partial<QuoteData>) => {
        setQuote((prev) => ({ ...prev, ...updates }));
    };

    const addService = () => {
        setQuote((prev) => ({
            ...prev,
            services: [...prev.services, createEmptyService()],
        }));
    };

    const removeService = (id: string) => {
        setQuote((prev) => ({
            ...prev,
            services: prev.services.filter((s) => s.id !== id),
        }));
    };

    const updateService = (id: string, updates: Partial<ServiceBlock>) => {
        setQuote((prev) => ({
            ...prev,
            services: prev.services.map((s) =>
                s.id === id ? { ...s, ...updates } : s
            ),
        }));
    };

    const saveQuote = useCallback(async (
        clientName?: string,
        clientEmail?: string,
        clientWhatsapp?: string,
        clientServiceTitle?: string
    ) => {
        if (!user) return;

        setIsSaving(true);
        try {
            const quoteRow = {
                user_id: user.id,
                title: quote.services[0]?.title || 'Untitled Quote',
                services: JSON.stringify(quote.services),
                base_value: parseFloat(quote.baseValue) || 0,
                vat_override: quote.vatOverride,
                estimated_time: quote.estimatedTime,
                expiration_date: quote.expirationDate,
                payment_conditions: quote.paymentConditions,
                client_name: clientName || '',
                client_email: clientEmail || '',
                client_whatsapp: clientWhatsapp || '',
                client_service_title: clientServiceTitle || '',
                updated_at: new Date().toISOString(),
            };

            if (currentQuoteId) {
                // Update existing quote
                const { error } = await supabase
                    .from('quotes')
                    .update(quoteRow)
                    .eq('id', currentQuoteId);

                if (error) throw error;
            } else {
                // Insert new quote
                const { data, error } = await supabase
                    .from('quotes')
                    .insert(quoteRow)
                    .select('id')
                    .single();

                if (error) throw error;
                if (data) setCurrentQuoteId(data.id);
            }

            // Refresh the saved quotes list
            await loadSavedQuotes();
        } catch (err) {
            console.error('Error saving quote:', err);
            throw err;
        } finally {
            setIsSaving(false);
        }
    }, [user, quote, currentQuoteId, supabase, loadSavedQuotes]);

    const loadQuote = useCallback(async (id: string) => {
        if (!user) return;

        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('quotes')
                .select('*')
                .eq('id', id)
                .eq('user_id', user.id)
                .single();

            if (error) throw error;

            if (data) {
                let services: ServiceBlock[];
                try {
                    services = typeof data.services === 'string'
                        ? JSON.parse(data.services)
                        : data.services;
                } catch {
                    services = [createEmptyService()];
                }

                setQuote({
                    services: services.length > 0 ? services : [createEmptyService()],
                    baseValue: data.base_value?.toString() || '',
                    vatOverride: data.vat_override || '',
                    estimatedTime: data.estimated_time || '',
                    expirationDate: data.expiration_date || '',
                    paymentConditions: data.payment_conditions || '',
                });
                setCurrentQuoteId(data.id);
            }
        } catch (err) {
            console.error('Error loading quote:', err);
        } finally {
            setIsLoading(false);
        }
    }, [user, supabase]);

    const deleteQuote = useCallback(async (id: string) => {
        if (!user) return;

        try {
            const { error } = await supabase
                .from('quotes')
                .delete()
                .eq('id', id)
                .eq('user_id', user.id);

            if (error) throw error;

            // If we deleted the currently active quote, clear the form
            if (id === currentQuoteId) {
                setQuote({ ...defaultQuote, services: [createEmptyService()] });
                setCurrentQuoteId(null);
            }

            await loadSavedQuotes();
        } catch (err) {
            console.error('Error deleting quote:', err);
        }
    }, [user, currentQuoteId, supabase, loadSavedQuotes]);

    const newQuote = () => {
        setQuote({
            ...defaultQuote,
            services: [createEmptyService()],
        });
        setCurrentQuoteId(null);
    };

    return (
        <QuoteContext.Provider
            value={{
                quote, currentQuoteId, updateQuote, addService, removeService, updateService,
                saveQuote, loadQuote, deleteQuote, newQuote,
                savedQuotes, loadSavedQuotes,
                isLoading, isSaving,
            }}
        >
            {children}
        </QuoteContext.Provider>
    );
}

export function useQuote() {
    const context = useContext(QuoteContext);
    if (!context) {
        throw new Error('useQuote must be used within a QuoteProvider');
    }
    return context;
}

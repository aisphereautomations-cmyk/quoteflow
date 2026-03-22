'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { useAuth } from './AuthContext';

export type PricingMode = 'sqm' | 'hour' | 'fixed';
export type PhotoLayout = 'full' | 'side' | 'grid';
export type PhotoAlignment = 'left' | 'center' | 'right';

export interface ServiceBlock {
    type: 'service';
    id: string;
    title: string;
    description: string;
    pricingMode: PricingMode;
    quantity: string;
    unitPrice: string;
    fixedPrice: string;
}

export interface PhotoBlock {
    type: 'photo';
    id: string;
    images: string[];         // data URLs or Supabase public URLs (max 3)
    layout: PhotoLayout;      // 'full' = 1 photo full-width, 'side' = 2 side-by-side, 'grid' = 3-col
    imageSize: number;        // 10-100 percentage — controls image width in PDF via slider
    alignment: PhotoAlignment; // 'left' | 'center' | 'right'
    caption: string;
}

export type QuoteBlock = ServiceBlock | PhotoBlock;

export interface GalleryPhoto {
    id: string;
    url: string;              // data URL or Supabase public URL
    caption: string;
}

export interface QuoteData {
    services: QuoteBlock[];
    galleryPhotos: GalleryPhoto[];
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
    addPhotoBlock: () => void;
    removeBlock: (id: string) => void;
    moveBlock: (id: string, direction: 'up' | 'down') => void;
    updateService: (id: string, updates: Partial<ServiceBlock>) => void;
    updatePhotoBlock: (id: string, updates: Partial<Omit<PhotoBlock, 'type' | 'id'>>) => void;
    addGalleryPhoto: (url: string) => void;
    removeGalleryPhoto: (id: string) => void;
    updateGalleryPhoto: (id: string, updates: Partial<Omit<GalleryPhoto, 'id'>>) => void;
    saveQuote: (clientName?: string, clientEmail?: string, clientWhatsapp?: string, clientServiceTitle?: string) => Promise<void>;
    loadQuote: (id: string) => Promise<void>;
    deleteQuote: (id: string) => Promise<void>;
    renameQuote: (id: string, newTitle: string) => Promise<void>;
    newQuote: () => void;
    savedQuotes: SavedQuote[];
    loadSavedQuotes: () => Promise<void>;
    isLoading: boolean;
    isSaving: boolean;
}

function createEmptyService(): ServiceBlock {
    return {
        type: 'service',
        id: crypto.randomUUID(),
        title: '',
        description: '',
        pricingMode: 'sqm',
        quantity: '',
        unitPrice: '',
        fixedPrice: '',
    };
}

function createEmptyPhotoBlock(): PhotoBlock {
    return {
        type: 'photo',
        id: crypto.randomUUID(),
        images: [],
        layout: 'full',
        imageSize: 100,
        alignment: 'center',
        caption: '',
    };
}

/** Normalize legacy service blocks (without type) when loading from DB */
function normalizeBlock(block: any): QuoteBlock {
    if (block.type === 'photo') return { imageSize: 100, alignment: 'center', ...block } as PhotoBlock;
    return { ...block, type: 'service' } as ServiceBlock;
}

const defaultQuote: QuoteData = {
    services: [createEmptyService()],
    galleryPhotos: [],
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

    const addPhotoBlock = () => {
        setQuote((prev) => ({
            ...prev,
            services: [...prev.services, createEmptyPhotoBlock()],
        }));
    };

    const removeBlock = (id: string) => {
        setQuote((prev) => ({
            ...prev,
            services: prev.services.filter((s) => s.id !== id),
        }));
    };

    const moveBlock = (id: string, direction: 'up' | 'down') => {
        setQuote((prev) => {
            const idx = prev.services.findIndex((s) => s.id === id);
            if (idx === -1) return prev;
            const newIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (newIdx < 0 || newIdx >= prev.services.length) return prev;
            const newServices = [...prev.services];
            [newServices[idx], newServices[newIdx]] = [newServices[newIdx], newServices[idx]];
            return { ...prev, services: newServices };
        });
    };

    const updateService = (id: string, updates: Partial<ServiceBlock>) => {
        setQuote((prev) => ({
            ...prev,
            services: prev.services.map((s) =>
                s.id === id && s.type === 'service' ? { ...s, ...updates } : s
            ),
        }));
    };

    const updatePhotoBlock = (id: string, updates: Partial<Omit<PhotoBlock, 'type' | 'id'>>) => {
        setQuote((prev) => ({
            ...prev,
            services: prev.services.map((s) =>
                s.id === id && s.type === 'photo' ? { ...s, ...updates } : s
            ),
        }));
    };

    const addGalleryPhoto = (url: string) => {
        setQuote((prev) => ({
            ...prev,
            galleryPhotos: [...prev.galleryPhotos, { id: crypto.randomUUID(), url, caption: '' }],
        }));
    };

    const removeGalleryPhoto = (id: string) => {
        setQuote((prev) => ({
            ...prev,
            galleryPhotos: prev.galleryPhotos.filter((p) => p.id !== id),
        }));
    };

    const updateGalleryPhoto = (id: string, updates: Partial<Omit<GalleryPhoto, 'id'>>) => {
        setQuote((prev) => ({
            ...prev,
            galleryPhotos: prev.galleryPhotos.map((p) =>
                p.id === id ? { ...p, ...updates } : p
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
            // Find the first service block title for the quote title
            const firstService = quote.services.find((b): b is ServiceBlock => b.type === 'service');
            const quoteRow = {
                user_id: user.id,
                title: firstService?.title || 'Untitled Quote',
                services: JSON.stringify(quote.services),
                gallery_photos: JSON.stringify(quote.galleryPhotos || []),
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
                let services: QuoteBlock[];
                try {
                    const raw = typeof data.services === 'string'
                        ? JSON.parse(data.services)
                        : data.services;
                    services = (raw as any[]).map(normalizeBlock);
                } catch {
                    services = [createEmptyService()];
                }

                let galleryPhotos: GalleryPhoto[] = [];
                try {
                    const rawGallery = typeof data.gallery_photos === 'string'
                        ? JSON.parse(data.gallery_photos)
                        : data.gallery_photos;
                    if (Array.isArray(rawGallery)) galleryPhotos = rawGallery;
                } catch { /* ignore */ }

                setQuote({
                    services: services.length > 0 ? services : [createEmptyService()],
                    galleryPhotos,
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
                setQuote({ ...defaultQuote, services: [createEmptyService()], galleryPhotos: [] });
                setCurrentQuoteId(null);
            }

            await loadSavedQuotes();
        } catch (err) {
            console.error('Error deleting quote:', err);
        }
    }, [user, currentQuoteId, supabase, loadSavedQuotes]);

    const renameQuote = useCallback(async (id: string, newTitle: string) => {
        if (!user || !newTitle.trim()) return;
        try {
            const { error } = await supabase
                .from('quotes')
                .update({ title: newTitle.trim(), updated_at: new Date().toISOString() })
                .eq('id', id)
                .eq('user_id', user.id);
            if (error) throw error;
            await loadSavedQuotes();
        } catch (err) {
            console.error('Error renaming quote:', err);
        }
    }, [user, supabase, loadSavedQuotes]);

    const newQuote = () => {
        setQuote({
            ...defaultQuote,
            services: [createEmptyService()],
            galleryPhotos: [],
        });
        setCurrentQuoteId(null);
    };

    return (
        <QuoteContext.Provider
            value={{
                quote, currentQuoteId, updateQuote,
                addService, addPhotoBlock, removeBlock, moveBlock,
                updateService, updatePhotoBlock,
                addGalleryPhoto, removeGalleryPhoto, updateGalleryPhoto,
                saveQuote, loadQuote, deleteQuote, renameQuote, newQuote,
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

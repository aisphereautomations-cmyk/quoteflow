'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { useAuth } from './AuthContext';

export interface SettingsData {
    companyName: string;
    email: string;
    phone: string;
    website: string;
    brandColor: string;
    currency: string;
    vatEnabled: boolean;
    vatPercentage: number;
    logoUrl: string | null;
    message: string;
    quoteDescription: string;
    taxCountry: string;
    language: string;
    headerExtraLines: string[];
    fileNamePattern: string;
    quoteCounter: number;
    customPricing: string;
}

interface SettingsContextType {
    settings: SettingsData;
    updateSettings: (updates: Partial<SettingsData>) => void;
    saveSettings: (dataToSave?: SettingsData) => Promise<void>;
    isLoading: boolean;
    isSaving: boolean;
}

const defaultSettings: SettingsData = {
    companyName: '',
    email: '',
    phone: '',
    website: '',
    brandColor: '#1e3a5f',
    currency: '€',
    vatEnabled: true,
    vatPercentage: 23,
    logoUrl: null,
    message: '',
    quoteDescription: 'Quote Description',
    taxCountry: 'uk',
    language: 'en',
    headerExtraLines: [],
    fileNamePattern: 'Quote_{n}',
    quoteCounter: 1,
    customPricing: '',
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const supabase = createClient();
    const [settings, setSettings] = useState<SettingsData>(defaultSettings);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Load settings from Supabase when user is available
    useEffect(() => {
        if (!user) {
            setSettings(defaultSettings);
            setIsLoading(false);
            return;
        }

        const loadSettings = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase
                    .from('user_settings')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (error && error.code !== 'PGRST116') {
                    // PGRST116 = no rows found (first time user)
                    console.error('Error loading settings:', error);
                }

                if (data) {
                    const lang = data.language || 'en';
                    // Parse headerExtraLines from JSON if stored as string
                    let extraLines: string[] = [];
                    try {
                        const raw = data.header_extra_lines;
                        if (Array.isArray(raw)) extraLines = raw;
                        else if (typeof raw === 'string' && raw) extraLines = JSON.parse(raw);
                    } catch { /* ignore */ }
                    setSettings({
                        companyName: data.company_name || '',
                        email: data.email || '',
                        phone: data.phone || '',
                        website: data.website || '',
                        brandColor: data.brand_color || '#1e3a5f',
                        currency: data.currency || '€',
                        vatEnabled: data.vat_enabled ?? true,
                        vatPercentage: data.vat_percentage ?? 23,
                        logoUrl: data.logo_url || null,
                        message: data.whatsapp_message || data.email_message || '',
                        quoteDescription: data.quote_description || 'Quote Description',
                        taxCountry: data.tax_country || 'uk',
                        language: lang,
                        headerExtraLines: extraLines,
                        fileNamePattern: data.file_name_pattern || 'Quote_{n}',
                        quoteCounter: data.quote_counter ?? 1,
                        customPricing: data.custom_pricing || '',
                    });
                    try { localStorage.setItem('quoteflow_language', lang); } catch { /* ignore */ }
                }
            } catch (err) {
                console.error('Error loading settings:', err);
            } finally {
                setIsLoading(false);
            }
        };

        loadSettings();
    }, [user]);

    const updateSettings = (updates: Partial<SettingsData>) => {
        setSettings((prev) => {
            const next = { ...prev, ...updates };
            // Sync language to localStorage so pages outside the provider (e.g. Login) can read it
            if (updates.language) {
                try { localStorage.setItem('quoteflow_language', updates.language); } catch { /* ignore */ }
            }
            return next;
        });
    };

    const saveSettings = useCallback(async (dataToSave?: SettingsData) => {
        if (!user) return;

        // Use provided data (avoids stale closure), or fall back to current state
        const data = dataToSave ?? settings;

        setIsSaving(true);
        try {
            // Handle logo upload if it's a data URL (from crop)
            let logoUrl = data.logoUrl;
            if (logoUrl && logoUrl.startsWith('data:')) {
                // Convert data URL to blob and upload to Supabase Storage
                const response = await fetch(logoUrl);
                const blob = await response.blob();
                const rawExt = blob.type.split('/')[1] || 'png';
                const fileExt = rawExt.includes('svg') ? 'svg' : rawExt;
                const fileName = `${user.id}/logo.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('logos')
                    .upload(fileName, blob, {
                        upsert: true,
                        contentType: blob.type,
                    });

                if (uploadError) {
                    console.error('Error uploading logo:', uploadError);
                    throw new Error(`Logo upload failed: ${uploadError.message}`);
                }

                const { data: urlData } = supabase.storage
                    .from('logos')
                    .getPublicUrl(fileName);
                // Append cache-busting param so the browser fetches the new image
                logoUrl = `${urlData.publicUrl}?t=${Date.now()}`;
            }

            const { error } = await supabase
                .from('user_settings')
                .upsert({
                    user_id: user.id,
                    company_name: data.companyName,
                    email: data.email,
                    phone: data.phone,
                    website: data.website,
                    brand_color: data.brandColor,
                    currency: data.currency,
                    vat_enabled: data.vatEnabled,
                    vat_percentage: data.vatPercentage,
                    logo_url: logoUrl,
                    whatsapp_message: data.message,
                    email_message: data.message,
                    quote_description: data.quoteDescription,
                    tax_country: data.taxCountry,
                    language: data.language,
                    header_extra_lines: JSON.stringify(data.headerExtraLines || []),
                    file_name_pattern: data.fileNamePattern || 'Quote_{n}',
                    quote_counter: data.quoteCounter ?? 1,
                    custom_pricing: data.customPricing || '',
                    updated_at: new Date().toISOString(),
                }, {
                    onConflict: 'user_id',
                });

            if (error) {
                console.error('Error saving settings:', error);
                throw error;
            }

            // Update local state with the stored logo URL
            if (logoUrl !== data.logoUrl) {
                setSettings((prev) => ({ ...prev, logoUrl }));
            }
        } catch (err) {
            console.error('Error saving settings:', err);
            throw err;
        } finally {
            setIsSaving(false);
        }
    }, [user, settings, supabase]);

    return (
        <SettingsContext.Provider value={{ settings, updateSettings, saveSettings, isLoading, isSaving }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}

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
                    });
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
        setSettings((prev) => ({ ...prev, ...updates }));
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
                const fileExt = blob.type.split('/')[1] || 'png';
                const fileName = `${user.id}/logo.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('logos')
                    .upload(fileName, blob, {
                        upsert: true,
                        contentType: blob.type,
                    });

                if (uploadError) {
                    console.error('Error uploading logo:', uploadError);
                } else {
                    const { data: urlData } = supabase.storage
                        .from('logos')
                        .getPublicUrl(fileName);
                    logoUrl = urlData.publicUrl;
                }
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

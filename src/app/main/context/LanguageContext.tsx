'use client';

import { createContext, useContext, useMemo, ReactNode } from 'react';
import { useSettings } from '@/app/main/context/SettingsContext';
import { getTranslator, type Locale } from '@/locales';

interface LanguageContextType {
    locale: Locale;
    t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
    const { settings } = useSettings();
    const locale = (settings.language || 'en') as Locale;

    const t = useMemo(() => getTranslator(locale), [locale]);

    return (
        <LanguageContext.Provider value={{ locale, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useTranslation() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useTranslation must be used within a LanguageProvider');
    }
    return context;
}

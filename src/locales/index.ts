import en from './en.json';
import pt from './pt.json';
import ptBR from './pt-BR.json';
import es from './es.json';
import fr from './fr.json';
import de from './de.json';
import nl from './nl.json';
import it from './it.json';

export type Locale = 'en' | 'pt' | 'pt-BR' | 'es' | 'fr' | 'de' | 'nl' | 'it';

export interface LocaleOption {
    code: Locale;
    label: string;
}

/** Available languages in the order shown in the Settings dropdown */
export const LOCALE_OPTIONS: LocaleOption[] = [
    { code: 'en', label: '🇬🇧 English' },
    { code: 'pt', label: '🇵🇹 Português' },
    { code: 'pt-BR', label: '🇧🇷 Português (BR)' },
    { code: 'es', label: '🇪🇸 Español' },
    { code: 'fr', label: '🇫🇷 Français' },
    { code: 'de', label: '🇩🇪 Deutsch' },
    { code: 'nl', label: '🇳🇱 Nederlands' },
    { code: 'it', label: '🇮🇹 Italiano' },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const messages: Record<Locale, any> = { en, pt, 'pt-BR': ptBR, es, fr, de, nl, it };

/**
 * Resolve a dot-separated key from a nested object.
 * Example: resolve('header.title', en) => 'Quote Flow'
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolve(key: string, obj: any): string {
    return key.split('.').reduce((o, k) => o?.[k], obj) ?? key;
}

/**
 * Return a translator function for the given locale.
 * Supports simple placeholder interpolation: t('pricing.getPlan', { planName: 'Pro' })
 */
export function getTranslator(locale: Locale) {
    const dict = messages[locale] ?? messages.en;

    return function t(key: string, params?: Record<string, string | number>): string {
        let text = resolve(key, dict);

        // Fallback to English if key not found in chosen locale
        if (text === key) {
            text = resolve(key, messages.en);
        }

        if (params) {
            Object.entries(params).forEach(([k, v]) => {
                text = text.replace(`{${k}}`, String(v));
            });
        }

        return text;
    };
}

/**
 * Format a number as a price string with proper thousand separators
 * based on the user's tax country setting.
 *
 * Examples:
 *   formatPrice(23000, 'pt') → "23.000,00"
 *   formatPrice(23000, 'uk') → "23,000.00"
 *   formatPrice(23000, 'fr') → "23 000,00"
 */

const TAX_COUNTRY_TO_LOCALE: Record<string, string> = {
    uk: 'en-GB',
    us: 'en-US',
    ie: 'en-IE',
    pt: 'pt-PT',
    br: 'pt-BR',
    es: 'es-ES',
    fr: 'fr-FR',
    be_fr: 'fr-BE',
    be_nl: 'nl-BE',
    nl: 'nl-NL',
    de: 'de-DE',
    ch_de: 'de-CH',
    ch_fr: 'fr-CH',
    it: 'it-IT',
};

/**
 * Format a numeric value as a price string with 2 decimal places
 * and thousand separators based on the tax country.
 */
export function formatPrice(value: number, taxCountry: string = 'uk'): string {
    const locale = TAX_COUNTRY_TO_LOCALE[taxCountry] || 'en-GB';
    return new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

/**
 * Same as formatPrice but returns '0,00' / '0.00' for zero/NaN values
 */
export function formatPriceOrZero(value: number, taxCountry: string = 'uk'): string {
    if (!value || isNaN(value)) return formatPrice(0, taxCountry);
    return formatPrice(value, taxCountry);
}

/**
 * Format a number as a price string with proper thousand separators
 * based on the user's tax country setting.
 *
 * Examples:
 *   formatPrice(23000, 'pt') → "23.000,00"
 *   formatPrice(23000, 'uk') → "23,000.00"
 *   formatPrice(23000, 'fr') → "23 000,00"
 */

// Map tax countries to locales that RELIABLY produce the right format.
// Note: Node.js pt-PT uses spaces instead of dots, so we use de-DE
// for all countries that expect dot-separated thousands (23.000,00).
const TAX_COUNTRY_TO_LOCALE: Record<string, string> = {
    uk: 'en-GB',
    us: 'en-US',
    ie: 'en-IE',
    pt: 'de-DE',     // 23.000,00 (Node.js pt-PT incorrectly uses spaces)
    br: 'de-DE',     // 23.000,00
    es: 'de-DE',     // 23.000,00
    fr: 'fr-FR',     // 23 000,00 (correct for France)
    be_fr: 'fr-FR',  // 23 000,00
    be_nl: 'de-DE',  // 23.000,00
    nl: 'de-DE',     // 23.000,00
    de: 'de-DE',     // 23.000,00
    ch_de: 'de-CH',  // 23'000.00
    ch_fr: 'fr-CH',  // 23 000,00
    it: 'de-DE',     // 23.000,00
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

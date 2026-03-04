export interface TaxLabelSet {
    /** The flag + country name shown in the dropdown */
    label: string;
    /** Short tax abbreviation (e.g. "VAT", "IVA") */
    taxName: string;
    /** "Price excluding VAT" in the local language */
    priceExcl: string;
    /** "Total incl. VAT" in the local language */
    totalIncl: string;
}

export const TAX_LABELS: Record<string, TaxLabelSet> = {
    uk: { label: '🇬🇧 United Kingdom', taxName: 'VAT', priceExcl: 'Price excluding VAT', totalIncl: 'Total incl. VAT' },
    us: { label: '🇺🇸 United States', taxName: 'Tax', priceExcl: 'Price excluding Tax', totalIncl: 'Total incl. Tax' },
    ie: { label: '🇮🇪 Ireland', taxName: 'VAT', priceExcl: 'Price excluding VAT', totalIncl: 'Total incl. VAT' },
    pt: { label: '🇵🇹 Portugal', taxName: 'IVA', priceExcl: 'Preço sem IVA', totalIncl: 'Total com IVA' },
    br: { label: '🇧🇷 Brasil', taxName: 'Imposto', priceExcl: 'Preço sem impostos', totalIncl: 'Total com impostos' },
    es: { label: '🇪🇸 España', taxName: 'IVA', priceExcl: 'Precio sin IVA', totalIncl: 'Total con IVA' },
    fr: { label: '🇫🇷 France', taxName: 'TVA', priceExcl: 'Prix hors TVA', totalIncl: 'Total TTC' },
    be_fr: { label: '🇧🇪 Belgique (FR)', taxName: 'TVA', priceExcl: 'Prix hors TVA', totalIncl: 'Total TTC' },
    be_nl: { label: '🇧🇪 België (NL)', taxName: 'BTW', priceExcl: 'Prijs excl. BTW', totalIncl: 'Totaal incl. BTW' },
    nl: { label: '🇳🇱 Nederland', taxName: 'BTW', priceExcl: 'Prijs excl. BTW', totalIncl: 'Totaal incl. BTW' },
    de: { label: '🇩🇪 Deutschland', taxName: 'MwSt', priceExcl: 'Preis ohne MwSt', totalIncl: 'Gesamtbetrag inkl. MwSt' },
    ch_de: { label: '🇨🇭 Schweiz (DE)', taxName: 'MwSt', priceExcl: 'Preis ohne MwSt', totalIncl: 'Gesamtbetrag inkl. MwSt' },
    ch_fr: { label: '🇨🇭 Suisse (FR)', taxName: 'TVA', priceExcl: 'Prix hors TVA', totalIncl: 'Total TTC' },
    it: { label: '🇮🇹 Italia', taxName: 'IVA', priceExcl: 'Prezzo escluso IVA', totalIncl: 'Totale incl. IVA' },
};

/** Get labels for a country code, fallback to UK */
export function getTaxLabels(countryCode: string): TaxLabelSet {
    return TAX_LABELS[countryCode] || TAX_LABELS['uk'];
}

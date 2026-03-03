'use client';

import { useQuote } from '../context/QuoteContext';
import { useSettings } from '../context/SettingsContext';
import { generateQuotePDF, downloadPDF } from '../utils/pdfGenerator';
import styles from './PDFPreview.module.css';

export default function PDFPreview() {
    const { quote } = useQuote();
    const { settings } = useSettings();

    const settingsVat = settings.vatEnabled ? settings.vatPercentage : 0;
    const vatPercent = quote.vatOverride !== '' ? (parseFloat(quote.vatOverride) || 0) : settingsVat;
    const baseVal = parseFloat(quote.baseValue) || 0;
    const vatAmount = (baseVal * vatPercent) / 100;
    const totalValue = baseVal + vatAmount;

    const handleDownload = async () => {
        const blob = await generateQuotePDF(settings, quote);
        downloadPDF(blob, 'quote.pdf');
    };

    // Only show services that have some content filled in
    const filledServices = quote.services.filter(
        (s) => s.title || s.description || s.fixedPrice || (s.quantity && s.unitPrice),
    );

    const getUnitLabel = (mode: string) => {
        if (mode === 'sqm') return 'm²';
        if (mode === 'hour') return 'hr';
        return '';
    };

    return (
        <div className={styles.previewContainer}>
            <h2 className={styles.sectionTitle}>PDF Preview</h2>

            {/* Scaler wrapper — shows full A4 width scaled down to fit mobile */}
            <div className={styles.previewScaler}>
                <div className={styles.previewPage}>

                    {/* ── Header ── */}
                    <div className={styles.pdfHeader}>
                        <div className={styles.companyInfo}>
                            {settings.companyName && (
                                <h3 className={styles.companyName}>{settings.companyName}</h3>
                            )}
                            {settings.phone && (
                                <p className={styles.companyDetail}>{settings.phone}</p>
                            )}
                            {settings.email && (
                                <p className={styles.companyDetail}>{settings.email}</p>
                            )}
                            {settings.website && (
                                <p className={styles.companyDetail}>{settings.website}</p>
                            )}
                        </div>
                        {settings.logoUrl && (
                            <div className={styles.logoArea}>
                                <img
                                    src={settings.logoUrl}
                                    alt="Logo"
                                    className={styles.logoImg}
                                />
                            </div>
                        )}
                    </div>

                    {/* ── Description Bar ── */}
                    <div
                        className={styles.descriptionBar}
                        style={{ backgroundColor: settings.brandColor }}
                    >
                        {settings.quoteDescription || 'Quote Description'}
                    </div>

                    {/* ── Services ── */}
                    {filledServices.length > 0 && (
                        <div className={styles.servicesBlock}>
                            {filledServices.map((service, idx) => {
                                let priceDisplay = '';
                                if (service.pricingMode === 'fixed') {
                                    if (service.fixedPrice) {
                                        priceDisplay = `${parseFloat(service.fixedPrice).toFixed(2)} ${settings.currency}`;
                                    }
                                } else if (service.quantity && service.unitPrice) {
                                    const unit = getUnitLabel(service.pricingMode);
                                    const total = (parseFloat(service.quantity) * parseFloat(service.unitPrice)).toFixed(2);
                                    priceDisplay = `${total} ${settings.currency} (${service.quantity} ${unit})`;
                                }

                                return (
                                    <div key={idx} className={styles.serviceItem}>
                                        <div className={styles.serviceRow}>
                                            <span className={styles.serviceTitle}>{service.title}</span>
                                            {priceDisplay && (
                                                <span className={styles.servicePrice}>{priceDisplay}</span>
                                            )}
                                        </div>
                                        {service.description && (
                                            <p className={styles.serviceDesc}>{service.description}</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ── Divider ── */}
                    <div
                        className={styles.dividerBar}
                        style={{ backgroundColor: settings.brandColor }}
                    />

                    {/* ── Bottom Section ── */}
                    <div className={styles.bottomSection}>
                        <div className={styles.footerInfo}>
                            {quote.estimatedTime && <p>{quote.estimatedTime}</p>}
                            {quote.expirationDate && <p>{quote.expirationDate}</p>}
                            {quote.paymentConditions && <p>{quote.paymentConditions}</p>}
                        </div>
                        <div className={styles.totals}>
                            <p className={styles.totalLine}>
                                Price excluding VAT: {settings.currency} {baseVal > 0 ? baseVal.toFixed(2) : '0.00'}
                            </p>
                            <p className={styles.totalLine}>
                                VAT {vatPercent}%: {settings.currency} {baseVal > 0 ? vatAmount.toFixed(2) : '0.00'}
                            </p>
                            <p className={styles.totalFinal}>
                                Total incl. VAT: {settings.currency} {totalValue > 0 ? totalValue.toFixed(2) : '0.00'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <button
                className={styles.downloadBtn}
                onClick={handleDownload}
            >
                Download PDF
            </button>
        </div>
    );
}

'use client';

import { useRef } from 'react';
import { useQuote } from '../context/QuoteContext';
import { useSettings } from '../context/SettingsContext';
import { generateAndDownloadPDF } from '../utils/pdfGenerator';
import styles from './PDFPreview.module.css';

export default function PDFPreview() {
    const { quote } = useQuote();
    const { settings } = useSettings();
    const previewRef = useRef<HTMLDivElement>(null);

    const settingsVat = settings.vatEnabled ? settings.vatPercentage : 0;
    const vatPercent = quote.vatOverride !== '' ? (parseFloat(quote.vatOverride) || 0) : settingsVat;
    const baseVal = parseFloat(quote.baseValue) || 0;
    const totalValue = baseVal + (baseVal * vatPercent) / 100;

    const handleDownload = async () => {
        if (!previewRef.current) return;
        await generateAndDownloadPDF(previewRef.current, 'quote.pdf');
    };

    // Only show services that have some content filled in
    const filledServices = quote.services.filter(
        (s) => s.title || s.description || s.fixedPrice || (s.quantity && s.unitPrice)
    );

    const getUnitLabel = (mode: string) => {
        if (mode === 'sqm') return 'm²';
        if (mode === 'hour') return 'hr';
        return '';
    };

    return (
        <div className={styles.previewContainer}>
            <h2 className={styles.sectionTitle}>PDF Preview</h2>

            <div className={styles.previewFrame} ref={previewRef}>
                {/* PDF Header */}
                <div className={styles.pdfHeader}>
                    <div className={styles.companyInfo}>
                        {settings.companyName && (
                            <h3 className={styles.companyName}>
                                {settings.companyName}
                            </h3>
                        )}
                        {settings.phone && (
                            <p className={styles.companyDetail}>
                                {settings.phone}
                            </p>
                        )}
                        {settings.email && (
                            <p className={styles.companyDetail}>
                                {settings.email}
                            </p>
                        )}
                        {settings.website && (
                            <p className={styles.companyDetail}>
                                {settings.website}
                            </p>
                        )}
                    </div>
                    {settings.logoUrl && (
                        <div className={styles.logoArea}>
                            <img
                                src={settings.logoUrl}
                                alt="Company logo"
                                className={styles.logoImage}
                            />
                        </div>
                    )}
                </div>

                {/* Quote Description Bar */}
                <div
                    className={styles.descriptionBar}
                    style={{ backgroundColor: settings.brandColor }}
                >
                    {settings.quoteDescription}
                </div>

                {/* Services — only show filled ones */}
                <div className={styles.servicesArea}>
                    {filledServices.map((service) => {
                        let priceDisplay = '';

                        if (service.pricingMode === 'fixed') {
                            if (service.fixedPrice) {
                                priceDisplay = `${parseFloat(service.fixedPrice).toFixed(2)} ${settings.currency}`;
                            }
                        } else if (service.quantity && service.unitPrice) {
                            const unit = getUnitLabel(service.pricingMode);
                            const total = (
                                parseFloat(service.quantity) *
                                parseFloat(service.unitPrice)
                            ).toFixed(2);
                            priceDisplay = `${total} ${settings.currency} (${service.quantity} ${unit})`;
                        }

                        return (
                            <div key={service.id} className={styles.serviceItem}>
                                <div className={styles.serviceRow}>
                                    {service.title && (
                                        <span className={styles.serviceTitle}>
                                            {service.title}
                                        </span>
                                    )}
                                    {priceDisplay && (
                                        <span className={styles.servicePrice}>
                                            {priceDisplay}
                                        </span>
                                    )}
                                </div>
                                {service.description && (
                                    <p className={styles.serviceDescription}>
                                        {service.description}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Totals Divider Bar */}
                <div
                    className={styles.totalsBar}
                    style={{ backgroundColor: settings.brandColor }}
                ></div>

                {/* Bottom Section: Values on top, Footer below */}
                <div className={styles.bottomSection}>
                    <div className={styles.valuesRight}>
                        <p className={styles.baseValueLine}>
                            Price excluding VAT: {settings.currency}{' '}
                            {baseVal > 0 ? baseVal.toFixed(2) : '0.00'}
                        </p>
                        <p className={styles.baseValueLine}>
                            VAT {vatPercent}%: {settings.currency}{' '}
                            {baseVal > 0 ? (totalValue - baseVal).toFixed(2) : '0.00'}
                        </p>
                        <p className={styles.totalValueLine}>
                            Total incl. VAT: {settings.currency}{' '}
                            {totalValue > 0 ? totalValue.toFixed(2) : '0.00'}
                        </p>
                    </div>
                    <div className={styles.footerLeft}>
                        {quote.estimatedTime && (
                            <p className={styles.footerLine}>
                                {quote.estimatedTime}
                            </p>
                        )}
                        {quote.expirationDate && (
                            <p className={styles.footerLine}>
                                {quote.expirationDate}
                            </p>
                        )}
                        {quote.paymentConditions && (
                            <p className={styles.footerLine}>
                                {quote.paymentConditions}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <button className={styles.downloadBtn} onClick={handleDownload}>Download PDF</button>
        </div>
    );
}

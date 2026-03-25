'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuote, type ServiceBlock, type PhotoBlock } from '../context/QuoteContext';
import { useSettings } from '../context/SettingsContext';
import { usePDF } from '../context/PDFContext';
import { useTranslation } from '../context/LanguageContext';
import { downloadPDF } from '../utils/pdfGenerator';
import { generateFileName } from '../utils/pdfGenerator';
import { getTaxLabels } from '../utils/taxLabels';
import { formatPrice } from '../utils/formatPrice';
import styles from './PDFPreview.module.css';

const PAGE_WIDTH = 595; // A4 width at 72dpi

export default function PDFPreview() {
    const { quote } = useQuote();
    const { settings } = useSettings();
    const { previewRef, capturePDF } = usePDF();
    const { t } = useTranslation();
    const scalerRef = useRef<HTMLDivElement>(null);
    const localPageRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [scaledH, setScaledH] = useState<number | undefined>(undefined);

    // Per-quote editable filename — initialized from Settings default
    const defaultFileName = generateFileName(settings.fileNamePattern || 'Quote_{n}', settings.quoteCounter || 1);
    const [customFileName, setCustomFileName] = useState(defaultFileName);
    useEffect(() => { setCustomFileName(defaultFileName); }, [defaultFileName]);

    // Register the local page ref into the shared PDF context
    useEffect(() => {
        previewRef.current = localPageRef.current;
    });

    const recalc = useCallback(() => {
        if (!scalerRef.current || !localPageRef.current) return;
        const containerW = scalerRef.current.offsetWidth;
        const s = containerW / PAGE_WIDTH;
        setScale(s);
        const pageH = localPageRef.current.offsetHeight;
        setScaledH(pageH * s);
    }, []);

    useEffect(() => {
        recalc();
        const ro = new ResizeObserver(recalc);
        if (scalerRef.current) ro.observe(scalerRef.current);
        if (localPageRef.current) ro.observe(localPageRef.current);
        return () => ro.disconnect();
    }, [recalc]);

    const settingsVat = settings.vatEnabled ? settings.vatPercentage : 0;
    const vatPercent = quote.vatOverride !== '' ? (parseFloat(quote.vatOverride) || 0) : settingsVat;
    const baseVal = parseFloat(quote.baseValue) || 0;
    const totalValue = baseVal + (baseVal * vatPercent) / 100;

    const taxLabels = getTaxLabels(settings.taxCountry);

    const handleDownload = async () => {
        const blob = await capturePDF();
        const fileName = customFileName || defaultFileName;
        if (blob) downloadPDF(blob, `${fileName}.pdf`);
    };

    // Only show service blocks that have some content filled in
    const filledBlocks = quote.services.filter((b) => {
        if (b.type === 'photo') return b.images.length > 0;
        return b.title || b.description || b.fixedPrice || (b.quantity && b.unitPrice);
    });

    const getUnitLabel = (mode: string) => {
        if (mode === 'sqm') return 'm²';
        if (mode === 'hour') return 'hr';
        return '';
    };

    /* ── Render a service block in the PDF ─── */
    const renderServiceBlock = (service: ServiceBlock) => {
        let priceDisplay = '';
        if (service.pricingMode === 'fixed') {
            if (service.fixedPrice) {
                priceDisplay = `${formatPrice(parseFloat(service.fixedPrice), settings.taxCountry)} ${settings.currency}`;
            }
        } else if (service.quantity && service.unitPrice) {
            const unit = getUnitLabel(service.pricingMode);
            const total = formatPrice(
                parseFloat(service.quantity) *
                parseFloat(service.unitPrice),
                settings.taxCountry
            );
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
    };

    /* ── Render a photo block in the PDF ─── */
    const renderPhotoBlock = (block: PhotoBlock) => {
        const layoutClass =
            block.layout === 'side' ? styles.photoLayoutSide :
            block.layout === 'grid' ? styles.photoLayoutGrid :
            styles.photoLayoutFull;

        const widthPercent = block.imageSize || 100;
        const align = block.alignment || 'center';

        const marginStyle: React.CSSProperties = { width: `${widthPercent}%` };
        if (widthPercent < 100) {
            if (align === 'center') {
                marginStyle.marginLeft = 'auto';
                marginStyle.marginRight = 'auto';
            } else if (align === 'right') {
                marginStyle.marginLeft = 'auto';
                marginStyle.marginRight = '0';
            } else {
                marginStyle.marginLeft = '0';
                marginStyle.marginRight = 'auto';
            }
        }

        return (
            <div
                key={block.id}
                className={styles.photoBlockPdf}
                style={marginStyle}
            >
                <div className={`${styles.photoBlockImages} ${layoutClass}`}>
                    {block.images.map((img, i) => (
                        <img key={i} src={img} alt="" className={styles.photoBlockImg} />
                    ))}
                </div>
                {block.caption && (
                    <p className={styles.photoBlockCaption}>{block.caption}</p>
                )}
            </div>
        );
    };

    return (
        <div className={styles.previewContainer}>
            <h2 className={styles.sectionTitle}>{t('pdfPreview.sectionTitle')}</h2>

            <div ref={scalerRef} className={styles.previewScaler} style={{ height: scaledH }}>
                <div
                    ref={localPageRef}
                    className={styles.previewFrame}
                    style={{
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                    }}
                >
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
                            {settings.headerExtraLines?.map((line, i) => (
                                line.trim() && (
                                    <p key={i} className={styles.companyDetail}>
                                        {line}
                                    </p>
                                )
                            ))}
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

                    {/* Services & Photo Blocks — rendered in order */}
                    <div className={styles.servicesArea}>
                        {filledBlocks.map((block) => {
                            if (block.type === 'photo') return renderPhotoBlock(block);
                            return renderServiceBlock(block);
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
                                {taxLabels.priceExcl}: {settings.currency}{' '}
                                {baseVal > 0 ? formatPrice(baseVal, settings.taxCountry) : formatPrice(0, settings.taxCountry)}
                            </p>
                            <p className={styles.baseValueLine}>
                                {taxLabels.taxName} {vatPercent}%: {settings.currency}{' '}
                                {baseVal > 0 ? formatPrice(totalValue - baseVal, settings.taxCountry) : formatPrice(0, settings.taxCountry)}
                            </p>
                            <p className={styles.totalValueLine}>
                                {taxLabels.totalIncl}: {settings.currency}{' '}
                                {totalValue > 0 ? formatPrice(totalValue, settings.taxCountry) : formatPrice(0, settings.taxCountry)}
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

                    {/* Footer Photo Blocks (after footer — at the very end) */}
                    {quote.footerBlocks.length > 0 && (
                        <div className={styles.servicesArea}>
                            {quote.footerBlocks.map((block) => renderPhotoBlock(block))}
                        </div>
                    )}
                </div>
            </div>

            <button className={styles.downloadBtn} onClick={handleDownload}>{t('pdfPreview.downloadPdf')}</button>

            <div className={styles.fileNameGroup}>
                <label className={styles.fileNameLabel}>{t('pdfPreview.fileName')}</label>
                <input
                    type="text"
                    className={styles.fileNameInput}
                    value={customFileName}
                    onChange={(e) => setCustomFileName(e.target.value)}
                    placeholder={defaultFileName}
                />
                <p className={styles.fileNameHint}>
                    {t('actionButtons.defaultSetInSettings')}
                </p>
            </div>
        </div>
    );
}

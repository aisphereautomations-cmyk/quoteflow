'use client';

import { useState, useEffect, useRef } from 'react';
import ImageCropper from './ImageCropper';
import { useQuote, PricingMode, ServiceBlock, PhotoBlock, type QuoteBlock } from '../context/QuoteContext';
import { useSettings } from '../context/SettingsContext';
import { useTranslation } from '../context/LanguageContext';
import { formatPrice } from '../utils/formatPrice';
import styles from './QuoteForm.module.css';

/* ── Service total calculation (only service blocks) ─────── */

function getServicesTotal(blocks: QuoteBlock[]): number {
    return blocks.reduce((sum, b) => {
        if (b.type !== 'service') return sum;
        if (b.pricingMode === 'fixed') {
            return sum + (parseFloat(b.fixedPrice) || 0);
        }
        return sum + ((parseFloat(b.quantity) || 0) * (parseFloat(b.unitPrice) || 0));
    }, 0);
}

/* ── Main Component ────────────────────────────────────────── */

export default function QuoteForm() {
    const {
        quote, updateQuote,
        addService, addPhotoBlock, removeBlock, moveBlock,
        updateService, updatePhotoBlock,
        addFooterBlock, removeFooterBlock, updateFooterBlock,
    } = useQuote();
    const { settings } = useSettings();
    const { t } = useTranslation();
    const [isBaseOverridden, setIsBaseOverridden] = useState(false);

    // Crop modal state
    const [cropSrc, setCropSrc] = useState<string | null>(null);
    const [cropTarget, setCropTarget] = useState<{ blockId: string; footer?: boolean } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    /** Add processed image to the target block */
    const addImageToTarget = (dataUrl: string) => {
        if (!cropTarget) return;

        if (cropTarget.footer) {
            const block = quote.footerBlocks.find(b => b.id === cropTarget.blockId);
            if (block) {
                updateFooterBlock(block.id, { images: [...block.images, dataUrl] });
            }
        } else {
            const block = quote.services.find(b => b.id === cropTarget.blockId);
            if (block && block.type === 'photo') {
                updatePhotoBlock(block.id, { images: [...block.images, dataUrl] });
            }
        }
        setCropSrc(null);
        setCropTarget(null);
    };

    const closeCropModal = () => {
        setCropSrc(null);
        setCropTarget(null);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, target: { blockId: string; footer?: boolean }) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            alert('Please upload a PNG, JPEG, or WebP image.');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setCropSrc(reader.result as string);
            setCropTarget(target);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const servicesTotal = getServicesTotal(quote.services);

    // Auto-update baseValue when services change (if not manually overridden)
    useEffect(() => {
        if (!isBaseOverridden) {
            const formatted = servicesTotal > 0 ? servicesTotal.toFixed(2) : '';
            if (quote.baseValue !== formatted) {
                updateQuote({ baseValue: formatted });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [servicesTotal, isBaseOverridden]);

    const settingsVat = settings.vatEnabled ? settings.vatPercentage : 0;
    const vatPercent = quote.vatOverride !== '' ? (parseFloat(quote.vatOverride) || 0) : settingsVat;
    const baseVal = parseFloat(quote.baseValue) || 0;
    const totalValue = baseVal + (baseVal * vatPercent) / 100;

    const pricingModeLabels: Record<PricingMode, { quantity: string; unitPrice: string; unit: string }> = {
        sqm: { quantity: 'm²', unitPrice: `${settings.currency}/m²`, unit: 'm²' },
        hour: { quantity: t('quoteForm.hour'), unitPrice: `${settings.currency}/hr`, unit: 'hr' },
        fixed: { quantity: '', unitPrice: '', unit: '' },
    };

    const totalBlocks = quote.services.length;

    /* ── Render a Service Block ──────────────────────────────── */
    const renderServiceBlock = (service: ServiceBlock, index: number) => (
        <div key={service.id} className={styles.serviceBlock}>
            <div className={styles.serviceHeader}>
                <div className={styles.serviceHeaderLeft}>
                    {totalBlocks > 1 && (
                        <div className={styles.reorderBtns}>
                            <button
                                className={styles.reorderBtn}
                                onClick={() => moveBlock(service.id, 'up')}
                                disabled={index === 0}
                                aria-label="Move block up"
                            >
                                ▲
                            </button>
                            <button
                                className={styles.reorderBtn}
                                onClick={() => moveBlock(service.id, 'down')}
                                disabled={index === totalBlocks - 1}
                                aria-label="Move block down"
                            >
                                ▼
                            </button>
                        </div>
                    )}
                    <span className={styles.serviceLabel}>{t('quoteForm.service')} {quote.services.filter(b => b.type === 'service').indexOf(service) + 1}</span>
                </div>
                <button
                    className={styles.removeBtn}
                    onClick={() => removeBlock(service.id)}
                    aria-label="Remove service"
                >
                    ✕
                </button>
            </div>

            <input
                type="text"
                placeholder={t('quoteForm.serviceTitlePlaceholder')}
                className={styles.input}
                value={service.title}
                onChange={(e) =>
                    updateService(service.id, { title: e.target.value })
                }
            />

            <textarea
                placeholder={t('quoteForm.serviceDescriptionPlaceholder')}
                className={styles.textarea}
                value={service.description}
                onChange={(e) =>
                    updateService(service.id, { description: e.target.value })
                }
            />

            {/* Pricing Mode Selector */}
            <div className={styles.pricingModeRow}>
                <label className={styles.metricLabel}>{t('quoteForm.pricing')}</label>
                <div className={styles.pricingModeOptions}>
                    {(['sqm', 'hour', 'fixed'] as PricingMode[]).map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            className={`${styles.pricingModeBtn} ${service.pricingMode === mode ? styles.pricingModeBtnActive : ''}`}
                            onClick={() => updateService(service.id, {
                                pricingMode: mode,
                                quantity: '',
                                unitPrice: '',
                                fixedPrice: '',
                            })}
                        >
                            {mode === 'sqm' ? 'm²' : mode === 'hour' ? t('quoteForm.hour') : t('quoteForm.fixed')}
                        </button>
                    ))}
                </div>
            </div>

            {/* Dynamic Pricing Inputs */}
            {service.pricingMode === 'fixed' ? (
                <div className={styles.metricsRow}>
                    <div className={styles.metricField} style={{ flex: 1 }}>
                        <label className={styles.metricLabel}>{t('quoteForm.price')} ({settings.currency})</label>
                        <input
                            type="number"
                            placeholder="0.00"
                            className={styles.metricInput}
                            value={service.fixedPrice}
                            onChange={(e) =>
                                updateService(service.id, {
                                    fixedPrice: e.target.value,
                                })
                            }
                        />
                    </div>
                    {service.fixedPrice && (
                        <div className={styles.calculatedPrice}>
                            {formatPrice(parseFloat(service.fixedPrice), settings.taxCountry)} {settings.currency}
                        </div>
                    )}
                </div>
            ) : (
                <div className={styles.metricsRow}>
                    <div className={styles.metricField}>
                        <label className={styles.metricLabel}>
                            {pricingModeLabels[service.pricingMode].quantity}
                        </label>
                        <input
                            type="number"
                            placeholder="0"
                            className={styles.metricInput}
                            value={service.quantity}
                            onChange={(e) =>
                                updateService(service.id, {
                                    quantity: e.target.value,
                                })
                            }
                        />
                    </div>
                    <div className={styles.metricField}>
                        <label className={styles.metricLabel}>
                            {pricingModeLabels[service.pricingMode].unitPrice}
                        </label>
                        <input
                            type="number"
                            placeholder="0"
                            className={styles.metricInput}
                            value={service.unitPrice}
                            onChange={(e) =>
                                updateService(service.id, {
                                    unitPrice: e.target.value,
                                })
                            }
                        />
                    </div>
                    {service.quantity && service.unitPrice && (
                        <div className={styles.calculatedPrice}>
                            {service.quantity} {pricingModeLabels[service.pricingMode].unit} –{' '}
                            {formatPrice(
                                parseFloat(service.quantity) *
                                parseFloat(service.unitPrice),
                                settings.taxCountry
                            )}{' '}
                            {settings.currency}
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    /* ── Render a Photo Block ──────────────────────────────── */
    const renderPhotoBlock = (block: PhotoBlock, index: number) => (
        <div key={block.id} className={styles.photoBlock}>
            <div className={styles.serviceHeader}>
                <div className={styles.serviceHeaderLeft}>
                    {totalBlocks > 1 && (
                        <div className={styles.reorderBtns}>
                            <button
                                className={styles.reorderBtn}
                                onClick={() => moveBlock(block.id, 'up')}
                                disabled={index === 0}
                                aria-label="Move block up"
                            >
                                ▲
                            </button>
                            <button
                                className={styles.reorderBtn}
                                onClick={() => moveBlock(block.id, 'down')}
                                disabled={index === totalBlocks - 1}
                                aria-label="Move block down"
                            >
                                ▼
                            </button>
                        </div>
                    )}
                    <span className={styles.serviceLabel}>📷 {t('quoteForm.photoBlock')}</span>
                </div>
                <button
                    className={styles.removeBtn}
                    onClick={() => removeBlock(block.id)}
                    aria-label="Remove photo block"
                >
                    ✕
                </button>
            </div>

            {/* Layout Selector */}
            <div className={styles.pricingModeRow}>
                <label className={styles.metricLabel}>{t('quoteForm.layout')}</label>
                <div className={styles.pricingModeOptions}>
                    <button
                        type="button"
                        className={`${styles.pricingModeBtn} ${block.layout === 'full' ? styles.pricingModeBtnActive : ''}`}
                        onClick={() => updatePhotoBlock(block.id, { layout: 'full' })}
                    >
                        {t('quoteForm.layoutFull')}
                    </button>
                    <button
                        type="button"
                        className={`${styles.pricingModeBtn} ${block.layout === 'side' ? styles.pricingModeBtnActive : ''}`}
                        onClick={() => updatePhotoBlock(block.id, { layout: 'side' })}
                    >
                        {t('quoteForm.layout2Grid')}
                    </button>
                    <button
                        type="button"
                        className={`${styles.pricingModeBtn} ${block.layout === 'grid' ? styles.pricingModeBtnActive : ''}`}
                        onClick={() => updatePhotoBlock(block.id, { layout: 'grid' })}
                    >
                        {t('quoteForm.layout3Grid')}
                    </button>
                </div>
            </div>

            {/* Image Size Slider */}
            <div className={styles.sizeSliderRow}>
                <label className={styles.metricLabel}>{t('quoteForm.imageSize')} {block.imageSize}%</label>
                <input
                    type="range"
                    min={10}
                    max={100}
                    step={1}
                    value={block.imageSize}
                    onChange={(e) => updatePhotoBlock(block.id, { imageSize: Number(e.target.value) })}
                    className={styles.sizeSlider}
                />
            </div>

            {/* Alignment Selector */}
            <div className={styles.pricingModeRow}>
                <label className={styles.metricLabel}>{t('quoteForm.alignment')}</label>
                <div className={styles.pricingModeOptions}>
                    <button
                        type="button"
                        className={`${styles.pricingModeBtn} ${block.alignment === 'left' ? styles.pricingModeBtnActive : ''}`}
                        onClick={() => updatePhotoBlock(block.id, { alignment: 'left' })}
                        aria-label="Align left"
                    >
                        <svg width="18" height="14" viewBox="0 0 18 14" fill="currentColor"><rect x="0" y="0" width="18" height="2" rx="1"/><rect x="0" y="4" width="12" height="2" rx="1"/><rect x="0" y="8" width="16" height="2" rx="1"/><rect x="0" y="12" width="10" height="2" rx="1"/></svg>
                    </button>
                    <button
                        type="button"
                        className={`${styles.pricingModeBtn} ${block.alignment === 'center' ? styles.pricingModeBtnActive : ''}`}
                        onClick={() => updatePhotoBlock(block.id, { alignment: 'center' })}
                        aria-label="Align center"
                    >
                        <svg width="18" height="14" viewBox="0 0 18 14" fill="currentColor"><rect x="0" y="0" width="18" height="2" rx="1"/><rect x="3" y="4" width="12" height="2" rx="1"/><rect x="1" y="8" width="16" height="2" rx="1"/><rect x="4" y="12" width="10" height="2" rx="1"/></svg>
                    </button>
                    <button
                        type="button"
                        className={`${styles.pricingModeBtn} ${block.alignment === 'right' ? styles.pricingModeBtnActive : ''}`}
                        onClick={() => updatePhotoBlock(block.id, { alignment: 'right' })}
                        aria-label="Align right"
                    >
                        <svg width="18" height="14" viewBox="0 0 18 14" fill="currentColor"><rect x="0" y="0" width="18" height="2" rx="1"/><rect x="6" y="4" width="12" height="2" rx="1"/><rect x="2" y="8" width="16" height="2" rx="1"/><rect x="8" y="12" width="10" height="2" rx="1"/></svg>
                    </button>
                </div>
            </div>

            {/* Photo Thumbnails */}
            <div className={styles.photoThumbnails}>
                {block.images.map((img, imgIdx) => (
                    <div key={imgIdx} className={styles.photoThumb}>
                        <img src={img} alt={`Photo ${imgIdx + 1}`} />
                        <button
                            className={styles.photoRemoveBtn}
                            onClick={() => {
                                const newImages = block.images.filter((_, i) => i !== imgIdx);
                                updatePhotoBlock(block.id, { images: newImages });
                            }}
                            aria-label="Remove photo"
                        >
                            ✕
                        </button>
                    </div>
                ))}
                {block.images.length < 3 && (
                    <button
                        className={styles.photoAddBtn}
                        onClick={() => {
                            setCropTarget({ blockId: block.id });
                            fileInputRef.current?.click();
                        }}
                    >
                        + {t('quoteForm.addPhoto')}
                    </button>
                )}
            </div>

            {/* Caption */}
            <input
                type="text"
                placeholder={t('quoteForm.captionPlaceholder')}
                className={styles.input}
                value={block.caption}
                onChange={(e) => updatePhotoBlock(block.id, { caption: e.target.value })}
            />
        </div>
    );

    return (
        <>
            {/* Crop Modal */}
            {cropSrc && (
                <ImageCropper
                    imageSrc={cropSrc}
                    onCrop={(url) => addImageToTarget(url)}
                    onSkip={(url) => addImageToTarget(url)}
                    onCancel={closeCropModal}
                    labels={{
                        cancel: t('quoteForm.cancel'),
                        skipCrop: t('quoteForm.skipCrop'),
                        cropAndAdd: t('quoteForm.cropAndAdd'),
                    }}
                />
            )}

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: 'none' }}
                onChange={(e) => {
                    if (cropTarget) handleFileSelect(e, cropTarget);
                }}
            />

            <div className={styles.formContainer}>
                <h2 className={styles.sectionTitle}>{t('quoteForm.sectionTitle')}</h2>

                {/* All blocks (service + photo) — rendered in order */}
                {quote.services.map((block, index) => {
                    if (block.type === 'photo') return renderPhotoBlock(block, index);
                    return renderServiceBlock(block, index);
                })}

                {/* Add Buttons */}
                <div className={styles.addBlockRow}>
                    <button className={styles.addServiceBtn} onClick={addService}>
                        {t('quoteForm.addService')}
                    </button>
                    <button className={styles.addPhotoBlockBtn} onClick={addPhotoBlock}>
                        📷 {t('quoteForm.addPhotoBlock')}
                    </button>
                </div>

                {/* Totals */}
                <div className={styles.totalsSection}>
                    <div className={styles.totalRow}>
                        <label className={styles.totalLabel}>{t('quoteForm.baseValue')} ({settings.currency})</label>
                        <div className={styles.baseInputWrapper}>
                            <input
                                type="number"
                                placeholder="0.00"
                                className={`${styles.totalInput} ${isBaseOverridden ? styles.totalInputOverridden : ''}`}
                                value={quote.baseValue}
                                onChange={(e) => {
                                    setIsBaseOverridden(true);
                                    updateQuote({ baseValue: e.target.value });
                                }}
                            />
                            {isBaseOverridden && (
                                <button
                                    type="button"
                                    className={styles.resetBaseBtn}
                                    onClick={() => {
                                        setIsBaseOverridden(false);
                                        const formatted = servicesTotal > 0 ? servicesTotal.toFixed(2) : '';
                                        updateQuote({ baseValue: formatted });
                                    }}
                                    title="Reset to auto-sum"
                                >
                                    ↺
                                </button>
                            )}
                        </div>
                    </div>
                    <div className={styles.totalRow}>
                        <span className={styles.totalLabel}>
                            {t('quoteForm.totalWithVat')}{' '}
                            <input
                                type="number"
                                className={styles.vatInput}
                                value={vatPercent}
                                onChange={(e) => updateQuote({ vatOverride: e.target.value })}
                            />
                            %
                        </span>
                        <span className={styles.totalValue}>
                            {formatPrice(totalValue, settings.taxCountry)} {settings.currency}
                        </span>
                    </div>
                </div>

                {/* Footer Fields */}
                <div className={styles.footerFields}>
                    <input
                        type="text"
                        placeholder={t('quoteForm.estimatedTimePlaceholder')}
                        className={styles.input}
                        value={quote.estimatedTime}
                        onChange={(e) => updateQuote({ estimatedTime: e.target.value })}
                    />
                    <input
                        type="text"
                        placeholder={t('quoteForm.expirationDatePlaceholder')}
                        className={styles.input}
                        value={quote.expirationDate}
                        onChange={(e) =>
                            updateQuote({ expirationDate: e.target.value })
                        }
                    />
                    <textarea
                        placeholder={t('quoteForm.paymentConditionsPlaceholder')}
                        className={styles.textarea}
                        value={quote.paymentConditions}
                        onChange={(e) =>
                            updateQuote({ paymentConditions: e.target.value })
                        }
                    />
                </div>

                {/* Footer Photo Blocks */}
                {quote.footerBlocks.map((block, idx) => (
                    <div key={block.id} className={styles.photoBlock} style={{ marginTop: 'var(--spacing-md)' }}>
                        <div className={styles.serviceHeader}>
                            <div className={styles.serviceHeaderLeft}>
                                {idx > 0 && (
                                    <button className={styles.moveBtn} onClick={() => {
                                        const newBlocks = [...quote.footerBlocks];
                                        [newBlocks[idx - 1], newBlocks[idx]] = [newBlocks[idx], newBlocks[idx - 1]];
                                        updateQuote({ footerBlocks: newBlocks });
                                    }}>▲</button>
                                )}
                                {idx < quote.footerBlocks.length - 1 && (
                                    <button className={styles.moveBtn} onClick={() => {
                                        const newBlocks = [...quote.footerBlocks];
                                        [newBlocks[idx], newBlocks[idx + 1]] = [newBlocks[idx + 1], newBlocks[idx]];
                                        updateQuote({ footerBlocks: newBlocks });
                                    }}>▼</button>
                                )}
                                <span className={styles.serviceLabel}>📷 {t('quoteForm.photoBlock')}</span>
                            </div>
                            <button
                                className={styles.removeBtn}
                                onClick={() => removeFooterBlock(block.id)}
                                aria-label="Remove photo block"
                            >✕</button>
                        </div>

                        {/* Layout */}
                        <div className={styles.pricingModeRow}>
                            <label className={styles.metricLabel}>{t('quoteForm.layout')}</label>
                            <div className={styles.pricingModeOptions}>
                                <button type="button" className={`${styles.pricingModeBtn} ${block.layout === 'full' ? styles.pricingModeBtnActive : ''}`} onClick={() => updateFooterBlock(block.id, { layout: 'full' })}>{t('quoteForm.layoutFull')}</button>
                                <button type="button" className={`${styles.pricingModeBtn} ${block.layout === 'side' ? styles.pricingModeBtnActive : ''}`} onClick={() => updateFooterBlock(block.id, { layout: 'side' })}>{t('quoteForm.layout2Grid')}</button>
                                <button type="button" className={`${styles.pricingModeBtn} ${block.layout === 'grid' ? styles.pricingModeBtnActive : ''}`} onClick={() => updateFooterBlock(block.id, { layout: 'grid' })}>{t('quoteForm.layout3Grid')}</button>
                            </div>
                        </div>

                        {/* Size Slider */}
                        <div className={styles.sizeSliderRow}>
                            <label className={styles.metricLabel}>{t('quoteForm.imageSize')} {block.imageSize}%</label>
                            <input type="range" min={10} max={100} step={1} value={block.imageSize} onChange={(e) => updateFooterBlock(block.id, { imageSize: Number(e.target.value) })} className={styles.sizeSlider} />
                        </div>

                        {/* Alignment */}
                        <div className={styles.pricingModeRow}>
                            <label className={styles.metricLabel}>{t('quoteForm.alignment')}</label>
                            <div className={styles.pricingModeOptions}>
                                <button type="button" className={`${styles.pricingModeBtn} ${block.alignment === 'left' ? styles.pricingModeBtnActive : ''}`} onClick={() => updateFooterBlock(block.id, { alignment: 'left' })} aria-label="Align left">
                                    <svg width="18" height="14" viewBox="0 0 18 14" fill="currentColor"><rect x="0" y="0" width="18" height="2" rx="1"/><rect x="0" y="4" width="12" height="2" rx="1"/><rect x="0" y="8" width="16" height="2" rx="1"/><rect x="0" y="12" width="10" height="2" rx="1"/></svg>
                                </button>
                                <button type="button" className={`${styles.pricingModeBtn} ${block.alignment === 'center' ? styles.pricingModeBtnActive : ''}`} onClick={() => updateFooterBlock(block.id, { alignment: 'center' })} aria-label="Align center">
                                    <svg width="18" height="14" viewBox="0 0 18 14" fill="currentColor"><rect x="0" y="0" width="18" height="2" rx="1"/><rect x="3" y="4" width="12" height="2" rx="1"/><rect x="1" y="8" width="16" height="2" rx="1"/><rect x="4" y="12" width="10" height="2" rx="1"/></svg>
                                </button>
                                <button type="button" className={`${styles.pricingModeBtn} ${block.alignment === 'right' ? styles.pricingModeBtnActive : ''}`} onClick={() => updateFooterBlock(block.id, { alignment: 'right' })} aria-label="Align right">
                                    <svg width="18" height="14" viewBox="0 0 18 14" fill="currentColor"><rect x="0" y="0" width="18" height="2" rx="1"/><rect x="6" y="4" width="12" height="2" rx="1"/><rect x="2" y="8" width="16" height="2" rx="1"/><rect x="8" y="12" width="10" height="2" rx="1"/></svg>
                                </button>
                            </div>
                        </div>

                        {/* Photo Thumbnails */}
                        <div className={styles.photoThumbnails}>
                            {block.images.map((img, imgIdx) => (
                                <div key={imgIdx} className={styles.photoThumb}>
                                    <img src={img} alt={`Photo ${imgIdx + 1}`} />
                                    <button className={styles.photoRemoveBtn} onClick={() => {
                                        const newImages = block.images.filter((_, i) => i !== imgIdx);
                                        updateFooterBlock(block.id, { images: newImages });
                                    }} aria-label="Remove photo">✕</button>
                                </div>
                            ))}
                            {block.images.length < 3 && (
                                <button className={styles.photoAddBtn} onClick={() => {
                                    setCropTarget({ blockId: block.id, footer: true });
                                    fileInputRef.current?.click();
                                }}>+ {t('quoteForm.addPhoto')}</button>
                            )}
                        </div>

                        {/* Caption */}
                        <input type="text" placeholder={t('quoteForm.captionPlaceholder')} className={styles.input} value={block.caption} onChange={(e) => updateFooterBlock(block.id, { caption: e.target.value })} />
                    </div>
                ))}

                <button className={styles.addPhotoBlockBtn} onClick={addFooterBlock}>
                    📷 {t('quoteForm.addPhotoBlock')}
                </button>
            </div>
        </>
    );
}

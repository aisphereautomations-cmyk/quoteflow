'use client';

import { useQuote, PricingMode } from '../context/QuoteContext';
import { useSettings } from '../context/SettingsContext';
import { useTranslation } from '../context/LanguageContext';
import styles from './QuoteForm.module.css';

export default function QuoteForm() {
    const { quote, updateQuote, addService, removeService, updateService } = useQuote();
    const { settings } = useSettings();
    const { t } = useTranslation();

    const settingsVat = settings.vatEnabled ? settings.vatPercentage : 0;
    const vatPercent = quote.vatOverride !== '' ? (parseFloat(quote.vatOverride) || 0) : settingsVat;
    const baseVal = parseFloat(quote.baseValue) || 0;
    const totalValue = baseVal + (baseVal * vatPercent) / 100;

    const pricingModeLabels: Record<PricingMode, { quantity: string; unitPrice: string; unit: string }> = {
        sqm: { quantity: 'm²', unitPrice: `${settings.currency}/m²`, unit: 'm²' },
        hour: { quantity: t('quoteForm.hour'), unitPrice: `${settings.currency}/hr`, unit: 'hr' },
        fixed: { quantity: '', unitPrice: '', unit: '' },
    };

    return (
        <div className={styles.formContainer}>
            <h2 className={styles.sectionTitle}>{t('quoteForm.sectionTitle')}</h2>

            {/* Service Blocks */}
            {quote.services.map((service, index) => (
                <div key={service.id} className={styles.serviceBlock}>
                    <div className={styles.serviceHeader}>
                        <span className={styles.serviceLabel}>{t('quoteForm.service')} {index + 1}</span>
                        {quote.services.length > 1 && (
                            <button
                                className={styles.removeBtn}
                                onClick={() => removeService(service.id)}
                                aria-label="Remove service"
                            >
                                ✕
                            </button>
                        )}
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
                                    {parseFloat(service.fixedPrice).toFixed(2)} {settings.currency}
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
                                    {(
                                        parseFloat(service.quantity) *
                                        parseFloat(service.unitPrice)
                                    ).toFixed(2)}{' '}
                                    {settings.currency}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}

            {/* Add Service Button */}
            <button className={styles.addServiceBtn} onClick={addService}>
                {t('quoteForm.addService')}
            </button>

            {/* Totals */}
            <div className={styles.totalsSection}>
                <div className={styles.totalRow}>
                    <label className={styles.totalLabel}>{t('quoteForm.baseValue')} ({settings.currency})</label>
                    <input
                        type="number"
                        placeholder="0.00"
                        className={styles.totalInput}
                        value={quote.baseValue}
                        onChange={(e) => updateQuote({ baseValue: e.target.value })}
                    />
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
                        {totalValue.toFixed(2)} {settings.currency}
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
        </div>
    );
}

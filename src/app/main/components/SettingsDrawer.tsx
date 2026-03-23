'use client';

import { useState, useRef, useCallback } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { useSettings } from '../context/SettingsContext';
import { useTranslation } from '../context/LanguageContext';
import { TAX_LABELS } from '../utils/taxLabels';
import { LOCALE_OPTIONS } from '@/locales';
import styles from './SettingsDrawer.module.css';
import ClientInfoStyles from './ClientInfo.module.css';

// Utility: apply crop to a canvas and return a data URL (PNG to keep transparency)
function getCroppedImg(imageSrc: string, crop: Area): Promise<string> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = crop.width;
            canvas.height = crop.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.drawImage(
                img,
                crop.x, crop.y, crop.width, crop.height,
                0, 0, crop.width, crop.height
            );

            resolve(canvas.toDataURL('image/png'));
        };
        img.src = imageSrc;
    });
}

export default function SettingsDrawer() {
    const { settings, updateSettings, saveSettings } = useSettings();
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [localLogoUrl, setLocalLogoUrl] = useState<string | null>(settings.logoUrl);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Crop modal state
    const [cropSrc, setCropSrc] = useState<string | null>(null);   // raw image for cropping
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedArea, setCroppedArea] = useState<Area | null>(null);
    const [cropAspect, setCropAspect] = useState<number | undefined>(undefined); // undefined = free

    const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
        setCroppedArea(croppedAreaPixels);
    }, []);

    const handleCropConfirm = async () => {
        if (!cropSrc || !croppedArea) return;
        const cropped = await getCroppedImg(cropSrc, croppedArea);
        setLocalLogoUrl(cropped);
        setCropSrc(null);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setCropAspect(undefined);
    };

    const handleCropCancel = () => {
        setCropSrc(null);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setCropAspect(undefined);
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate type
        const validTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            alert(t('settings.uploadValidation'));
            return;
        }

        // For SVGs, read directly (they scale perfectly, no crop needed)
        if (file.type === 'image/svg+xml') {
            const reader = new FileReader();
            reader.onload = () => setLocalLogoUrl(reader.result as string);
            reader.readAsDataURL(file);
            e.target.value = '';
            return;
        }

        // For raster images: open the crop modal
        const reader = new FileReader();
        reader.onload = () => {
            setCropSrc(reader.result as string);
        };
        reader.readAsDataURL(file);

        // Reset input so the same file can be re-selected
        e.target.value = '';
    };

    // Local state mirrors context so user can cancel without saving
    const [localCompanyName, setLocalCompanyName] = useState(settings.companyName);
    const [localEmail, setLocalEmail] = useState(settings.email);
    const [localPhone, setLocalPhone] = useState(settings.phone);
    const [localWebsite, setLocalWebsite] = useState(settings.website);
    const [localBrandColor, setLocalBrandColor] = useState(settings.brandColor);
    const [localCurrency, setLocalCurrency] = useState(settings.currency);
    const [localVatEnabled, setLocalVatEnabled] = useState(settings.vatEnabled);
    const [localVatPercentage, setLocalVatPercentage] = useState(settings.vatPercentage);
    const [localMessage, setLocalMessage] = useState(settings.message);
    const [localQuoteDescription, setLocalQuoteDescription] = useState(settings.quoteDescription);
    const [localTaxCountry, setLocalTaxCountry] = useState(settings.taxCountry);
    const [localLanguage, setLocalLanguage] = useState(settings.language);
    const [localHeaderExtraLines, setLocalHeaderExtraLines] = useState<string[]>(settings.headerExtraLines);
    const [localFileNamePattern, setLocalFileNamePattern] = useState(settings.fileNamePattern);
    const [localQuoteCounter, setLocalQuoteCounter] = useState(settings.quoteCounter);
    const [localCustomPricing, setLocalCustomPricing] = useState(settings.customPricing);

    const handleOpen = () => {
        // Sync local state from context when opening
        setLocalCompanyName(settings.companyName);
        setLocalEmail(settings.email);
        setLocalPhone(settings.phone);
        setLocalWebsite(settings.website);
        setLocalLogoUrl(settings.logoUrl);
        setLocalBrandColor(settings.brandColor);
        setLocalCurrency(settings.currency);
        setLocalVatEnabled(settings.vatEnabled);
        setLocalVatPercentage(settings.vatPercentage);
        setLocalMessage(settings.message);
        setLocalQuoteDescription(settings.quoteDescription);
        setLocalTaxCountry(settings.taxCountry);
        setLocalLanguage(settings.language);
        setLocalHeaderExtraLines([...(settings.headerExtraLines || [])]);
        setLocalFileNamePattern(settings.fileNamePattern);
        setLocalQuoteCounter(settings.quoteCounter);
        setLocalCustomPricing(settings.customPricing);
        setIsOpen(true);
    };

    const handleSave = async () => {
        const newSettings = {
            companyName: localCompanyName,
            email: localEmail,
            phone: localPhone,
            website: localWebsite,
            logoUrl: localLogoUrl,
            brandColor: localBrandColor,
            currency: localCurrency,
            vatEnabled: localVatEnabled,
            vatPercentage: localVatPercentage,
            message: localMessage,
            quoteDescription: localQuoteDescription,
            taxCountry: localTaxCountry,
            language: localLanguage,
            headerExtraLines: localHeaderExtraLines.filter(l => l.trim() !== ''),
            fileNamePattern: localFileNamePattern,
            quoteCounter: localQuoteCounter,
            customPricing: localCustomPricing,
        };

        // Update context state for immediate UI reflection
        updateSettings(newSettings);

        // Persist to Supabase — pass data directly to avoid stale closure
        try {
            await saveSettings(newSettings);
            setIsOpen(false);
        } catch (err) {
            console.error('Failed to save settings:', err);
            const msg = err instanceof Error ? err.message : 'Unknown error';
            alert(`${t('settings.failedToSave')}: ${msg}`);
        }
    };

    const handleToggle = () => {
        if (isOpen) {
            setIsOpen(false);
        } else {
            handleOpen();
        }
    };

    return (
        <>
            {/* Crop Modal Overlay */}
            {cropSrc && (
                <div className={styles.cropOverlay}>
                    <div className={styles.cropContainer}>
                        <Cropper
                            image={cropSrc}
                            crop={crop}
                            zoom={zoom}
                            aspect={cropAspect}
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onCropComplete={onCropComplete}
                        />
                    </div>
                    <div className={styles.cropControls}>
                        <div className={styles.aspectRow}>
                            <span className={styles.aspectLabel}>{t('settings.shape')}</span>
                            <button
                                type="button"
                                className={`${styles.aspectBtn} ${cropAspect === undefined ? styles.aspectBtnActive : ''}`}
                                onClick={() => setCropAspect(undefined)}
                            >
                                {t('settings.free')}
                            </button>
                            <button
                                type="button"
                                className={`${styles.aspectBtn} ${cropAspect === 1 ? styles.aspectBtnActive : ''}`}
                                onClick={() => setCropAspect(1)}
                            >
                                {t('settings.square')}
                            </button>
                            <button
                                type="button"
                                className={`${styles.aspectBtn} ${cropAspect === 16 / 9 ? styles.aspectBtnActive : ''}`}
                                onClick={() => setCropAspect(16 / 9)}
                            >
                                {t('settings.wide')}
                            </button>
                        </div>
                        <label className={styles.zoomLabel}>
                            {t('settings.zoom')}
                            <input
                                type="range"
                                min={1}
                                max={3}
                                step={0.05}
                                value={zoom}
                                onChange={(e) => setZoom(Number(e.target.value))}
                                className={styles.zoomSlider}
                            />
                        </label>
                        <div className={styles.cropActions}>
                            <button className={`${styles.actionBtn} ${styles.cancelBtn}`} onClick={handleCropCancel}>
                                {t('settings.cancel')}
                            </button>
                            <button className={`${styles.actionBtn} ${styles.saveBtn}`} onClick={handleCropConfirm}>
                                {t('settings.confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className={styles.drawer}>
                <div className={styles.header} onClick={handleToggle}>
                    <div className={styles.title}>
                        <span>{t('settings.title')}</span>
                    </div>
                    <span>{isOpen ? '▼' : '▲'}</span>
                </div>

                <div className={`${styles.content} ${isOpen ? styles.open : ''}`}>
                    <div className={styles.section}>
                        <h3 className="shared-subsection-title">{t('settings.companyInformation')}</h3>
                        <div className={styles.companyInputsWrapper}>
                            <div className={styles.companyInputsColumn}>
                                <input
                                    type="text"
                                    placeholder={t('settings.companyNamePlaceholder')}
                                    className={ClientInfoStyles.inputField}
                                    value={localCompanyName}
                                    onChange={(e) => setLocalCompanyName(e.target.value)}
                                />
                                <input
                                    type="email"
                                    placeholder={t('settings.emailPlaceholder')}
                                    className={ClientInfoStyles.inputField}
                                    value={localEmail}
                                    onChange={(e) => setLocalEmail(e.target.value)}
                                />
                                <input
                                    type="tel"
                                    placeholder={t('settings.phonePlaceholder')}
                                    className={ClientInfoStyles.inputField}
                                    value={localPhone}
                                    onChange={(e) => setLocalPhone(e.target.value)}
                                />
                            </div>
                            <div className={styles.logoSection}>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                                    onChange={handleLogoUpload}
                                    style={{ display: 'none' }}
                                />
                                <div
                                    className={styles.logoPlaceholder}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {localLogoUrl && (
                                        <img
                                            src={localLogoUrl}
                                            alt="Company logo"
                                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '6px' }}
                                        />
                                    )}
                                </div>
                                <div className={styles.logoLabel}>{t('settings.companyLogo')}</div>
                                <button
                                    className={styles.swapImageBtn}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {t('settings.swapImage')}
                                </button>
                                {localLogoUrl && (
                                    <button
                                        className={styles.swapImageBtn}
                                        onClick={() => setLocalLogoUrl(null)}
                                        style={{ marginTop: '0.25rem', color: '#ef4444' }}
                                    >
                                        {t('settings.remove')}
                                    </button>
                                )}
                            </div>
                        </div>
                        <input
                            type="text"
                            placeholder={t('settings.websitePlaceholder')}
                            className={`${ClientInfoStyles.inputField} ${styles.websiteInput}`}
                            value={localWebsite}
                            onChange={(e) => setLocalWebsite(e.target.value)}
                        />
                        <input
                            type="text"
                            placeholder={t('settings.quoteDescriptionPlaceholder')}
                            className={`${ClientInfoStyles.inputField} ${styles.websiteInput}`}
                            value={localQuoteDescription}
                            onChange={(e) => setLocalQuoteDescription(e.target.value)}
                        />
                    </div>

                    <div className={styles.optionsGrid}>
                        <div className={styles.optionRow}>
                            {t('settings.language')}{' '}
                            <select
                                value={localLanguage}
                                onChange={(e) => setLocalLanguage(e.target.value)}
                                className={styles.currencyInput}
                                aria-label="App language"
                                style={{ minWidth: 160 }}
                            >
                                {LOCALE_OPTIONS.map(({ code, label }) => (
                                    <option key={code} value={code}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.optionRow}>
                            {t('settings.brandColor')}{' '}
                            <input
                                type="color"
                                value={localBrandColor}
                                onChange={(e) => setLocalBrandColor(e.target.value)}
                                className={styles.colorInput}
                                aria-label="Brand color picker"
                            />
                        </div>
                        <div className={styles.optionRow}>
                            {t('settings.currencyUsed')}{' '}
                            <input
                                type="text"
                                value={localCurrency}
                                onChange={(e) => setLocalCurrency(e.target.value)}
                                className={styles.currencyInput}
                                placeholder="$"
                                maxLength={3}
                                aria-label="Currency symbol"
                            />
                        </div>
                        <div className={styles.optionRow}>
                            {t('settings.taxCountry')}{' '}
                            <select
                                value={localTaxCountry}
                                onChange={(e) => setLocalTaxCountry(e.target.value)}
                                className={styles.currencyInput}
                                aria-label="Tax country"
                                style={{ minWidth: 160 }}
                            >
                                {Object.entries(TAX_LABELS).map(([code, { label }]) => (
                                    <option key={code} value={code}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.optionRow}>
                            <label className={styles.vatLabel}>
                                {t('settings.vat')}
                            </label>
                            <div className={styles.vatInputWrapper}>
                                <input
                                    type="radio"
                                    name="vat-type"
                                    checked={localVatEnabled}
                                    onChange={() => setLocalVatEnabled(true)}
                                    aria-label="Fixed VAT percentage"
                                />
                                <input
                                    id="vat-input"
                                    type="number"
                                    value={localVatEnabled ? localVatPercentage : ''}
                                    onChange={(e) => setLocalVatPercentage(Number(e.target.value))}
                                    className={styles.vatInput}
                                    placeholder="23"
                                    min="0"
                                    max="100"
                                    disabled={!localVatEnabled}
                                />
                                <span className={styles.percentSymbol}>%</span>

                                <label className={styles.variableLabel}>
                                    <input
                                        type="radio"
                                        name="vat-type"
                                        checked={!localVatEnabled}
                                        onChange={() => setLocalVatEnabled(false)}
                                        aria-label="No VAT"
                                    />
                                    {t('settings.none')}
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* ── Extra Header Lines ── */}
                    <div className={styles.section}>
                        <h3 className="shared-subsection-title">{t('settings.headerExtraLines')}</h3>
                        <p className={styles.sectionHint}>{t('settings.headerExtraLinesHint')}</p>
                        <div className={styles.extraLinesWrapper}>
                            {localHeaderExtraLines.map((line, i) => (
                                <div key={i} className={styles.extraLineRow}>
                                    <input
                                        type="text"
                                        value={line}
                                        onChange={(e) => {
                                            const updated = [...localHeaderExtraLines];
                                            updated[i] = e.target.value;
                                            setLocalHeaderExtraLines(updated);
                                        }}
                                        className={ClientInfoStyles.inputField}
                                        placeholder={t('settings.extraLinePlaceholder')}
                                    />
                                    <button
                                        type="button"
                                        className={styles.removeLineBtn}
                                        onClick={() => setLocalHeaderExtraLines(localHeaderExtraLines.filter((_, j) => j !== i))}
                                        aria-label="Remove line"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    </button>
                                </div>
                            ))}
                            {localHeaderExtraLines.length < 5 && (
                                <button
                                    type="button"
                                    className={styles.addLineBtn}
                                    onClick={() => setLocalHeaderExtraLines([...localHeaderExtraLines, ''])}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                    {t('settings.addLine')}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ── File Name Pattern + Counter ── */}
                    <div className={styles.section}>
                        <h3 className="shared-subsection-title">{t('settings.fileNamePattern')}</h3>
                        <div className={styles.fileNameRow}>
                            <input
                                type="text"
                                value={localFileNamePattern}
                                onChange={(e) => setLocalFileNamePattern(e.target.value)}
                                className={ClientInfoStyles.inputField}
                                placeholder="Quote_{n}"
                            />
                        </div>
                        <div className={styles.counterRow}>
                            <span className={styles.counterLabel}>{t('settings.currentCounter')}:</span>
                            <input
                                type="number"
                                min={1}
                                value={localQuoteCounter}
                                onChange={(e) => setLocalQuoteCounter(Math.max(1, parseInt(e.target.value) || 1))}
                                className={styles.counterInput}
                            />
                            <button
                                type="button"
                                className={styles.resetCounterBtn}
                                onClick={() => setLocalQuoteCounter(1)}
                            >
                                {t('settings.resetCounter')}
                            </button>
                        </div>
                        <p className={styles.sectionHint}>
                            {t('settings.fileNamePreview')}: <strong>{
                                localFileNamePattern.includes('{n}')
                                    ? localFileNamePattern.replace('{n}', String(localQuoteCounter).padStart(3, '0'))
                                    : `${localFileNamePattern}_${String(localQuoteCounter).padStart(3, '0')}`
                            }.pdf</strong>
                        </p>
                    </div>

                    {/* ── Custom Pricing ── */}
                    <div className={styles.section}>
                        <h3 className="shared-subsection-title">{t('settings.customPricing')}</h3>
                        <p className={styles.sectionHint}>{t('settings.customPricingHint')}</p>
                        <div className={styles.messageGroup}>
                            <textarea
                                id="settings-pricing"
                                className="shared-textarea"
                                placeholder={t('settings.customPricingPlaceholder')}
                                value={localCustomPricing}
                                onChange={(e) => setLocalCustomPricing(e.target.value)}
                                rows={5}
                            />
                        </div>
                    </div>

                    <div className={styles.section}>
                        <h3 className="shared-subsection-title">{t('settings.predefinedMessage')}</h3>

                        <div className={styles.messageGroup}>
                            <textarea
                                id="settings-message"
                                className="shared-textarea"
                                placeholder={t('settings.defaultMessagePlaceholder')}
                                value={localMessage}
                                onChange={(e) => setLocalMessage(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className={styles.footerActions}>
                        <button
                            className={`${styles.actionBtn} ${styles.saveBtn}`}
                            onClick={handleSave}
                            aria-label="Save settings"
                        >
                            {t('settings.save')}
                        </button>
                        <button
                            className={`${styles.actionBtn} ${styles.cancelBtn}`}
                            onClick={() => setIsOpen(false)}
                            aria-label="Cancel"
                        >
                            {t('settings.cancel')}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

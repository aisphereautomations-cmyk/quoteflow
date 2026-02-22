'use client';

import { useState, useRef, useCallback } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { useSettings } from '../context/SettingsContext';
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
    const [isOpen, setIsOpen] = useState(false);
    const [localLogoUrl, setLocalLogoUrl] = useState<string | null>(settings.logoUrl);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Crop modal state
    const [cropSrc, setCropSrc] = useState<string | null>(null);   // raw image for cropping
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedArea, setCroppedArea] = useState<Area | null>(null);

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
    };

    const handleCropCancel = () => {
        setCropSrc(null);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate type
        const validTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            alert('Please upload a PNG, JPG, SVG, or WebP image.');
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
    const [localWhatsappMessage, setLocalWhatsappMessage] = useState(settings.whatsappMessage);
    const [localEmailMessage, setLocalEmailMessage] = useState(settings.emailMessage);
    const [localQuoteDescription, setLocalQuoteDescription] = useState(settings.quoteDescription);

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
        setLocalWhatsappMessage(settings.whatsappMessage);
        setLocalEmailMessage(settings.emailMessage);
        setLocalQuoteDescription(settings.quoteDescription);
        setIsOpen(true);
    };

    const handleSave = async () => {
        updateSettings({
            companyName: localCompanyName,
            email: localEmail,
            phone: localPhone,
            website: localWebsite,
            logoUrl: localLogoUrl,
            brandColor: localBrandColor,
            currency: localCurrency,
            vatEnabled: localVatEnabled,
            vatPercentage: localVatPercentage,
            whatsappMessage: localWhatsappMessage,
            emailMessage: localEmailMessage,
            quoteDescription: localQuoteDescription,
        });
        // Persist to Supabase — saveSettings will use the updated state
        // We need a small delay to ensure state has been updated
        setTimeout(async () => {
            try {
                await saveSettings();
            } catch (err) {
                console.error('Failed to save settings:', err);
            }
        }, 100);
        setIsOpen(false);
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
                            aspect={1}
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onCropComplete={onCropComplete}
                        />
                    </div>
                    <div className={styles.cropControls}>
                        <label className={styles.zoomLabel}>
                            Zoom
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
                                Cancel
                            </button>
                            <button className={`${styles.actionBtn} ${styles.saveBtn}`} onClick={handleCropConfirm}>
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className={styles.drawer}>
                <div className={styles.header} onClick={handleToggle}>
                    <div className={styles.title}>
                        <span>⚙️ Settings</span>
                    </div>
                    <span>{isOpen ? '▼' : '▲'}</span>
                </div>

                <div className={`${styles.content} ${isOpen ? styles.open : ''}`}>
                    <div className={styles.section}>
                        <h3 className="shared-subsection-title">Company Information</h3>
                        <div className={styles.companyInputsWrapper}>
                            <div className={styles.companyInputsColumn}>
                                <input
                                    type="text"
                                    placeholder="Company Name"
                                    className={ClientInfoStyles.inputField}
                                    value={localCompanyName}
                                    onChange={(e) => setLocalCompanyName(e.target.value)}
                                />
                                <input
                                    type="email"
                                    placeholder="Email"
                                    className={ClientInfoStyles.inputField}
                                    value={localEmail}
                                    onChange={(e) => setLocalEmail(e.target.value)}
                                />
                                <input
                                    type="tel"
                                    placeholder="Phone Number"
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
                                <div className={styles.logoLabel}>Company Logo</div>
                                <button
                                    className={styles.swapImageBtn}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    Swap Image
                                </button>
                                {localLogoUrl && (
                                    <button
                                        className={styles.swapImageBtn}
                                        onClick={() => setLocalLogoUrl(null)}
                                        style={{ marginTop: '0.25rem', color: '#ef4444' }}
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        </div>
                        <input
                            type="text"
                            placeholder="Website"
                            className={`${ClientInfoStyles.inputField} ${styles.websiteInput}`}
                            value={localWebsite}
                            onChange={(e) => setLocalWebsite(e.target.value)}
                        />
                        <input
                            type="text"
                            placeholder="Quote Description"
                            className={`${ClientInfoStyles.inputField} ${styles.websiteInput}`}
                            value={localQuoteDescription}
                            onChange={(e) => setLocalQuoteDescription(e.target.value)}
                        />
                    </div>

                    <div className={styles.optionsGrid}>
                        <div className={styles.optionRow}>
                            Brand Color:{' '}
                            <input
                                type="color"
                                value={localBrandColor}
                                onChange={(e) => setLocalBrandColor(e.target.value)}
                                className={styles.colorInput}
                                aria-label="Brand color picker"
                            />
                        </div>
                        <div className={styles.optionRow}>
                            Currency Used:{' '}
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
                            <label className={styles.vatLabel}>
                                VAT:
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
                                    None
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className={styles.section}>
                        <h3 className="shared-subsection-title">Pre-defined messages</h3>

                        <div className={styles.messageGroup}>
                            <label htmlFor="settings-whatsapp-message" className={styles.label}>
                                Whatsapp:
                            </label>
                            <textarea
                                id="settings-whatsapp-message"
                                className="shared-textarea"
                                placeholder="Default message template for Whatsapp..."
                                value={localWhatsappMessage}
                                onChange={(e) => setLocalWhatsappMessage(e.target.value)}
                            />
                        </div>

                        <div className={styles.messageGroup}>
                            <label htmlFor="settings-email-message" className={styles.label}>
                                Email:
                            </label>
                            <textarea
                                id="settings-email-message"
                                className="shared-textarea"
                                placeholder="Default message template for Email..."
                                value={localEmailMessage}
                                onChange={(e) => setLocalEmailMessage(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className={styles.footerActions}>
                        <button
                            className={`${styles.actionBtn} ${styles.saveBtn}`}
                            onClick={handleSave}
                            aria-label="Save settings"
                        >
                            Save
                        </button>
                        <button
                            className={`${styles.actionBtn} ${styles.cancelBtn}`}
                            onClick={() => setIsOpen(false)}
                            aria-label="Cancel"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

'use client';

import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useTranslation } from '../context/LanguageContext';
import { usePDF } from '../context/PDFContext';
import { downloadPDF } from '../utils/pdfGenerator';
import styles from './ActionButtons.module.css';

export default function ActionButtons() {
    const { settings } = useSettings();
    const { capturePDF } = usePDF();
    const { t } = useTranslation();

    // Local editable message — initialized from Settings default
    const [message, setMessage] = useState(settings.message);

    // Sync with settings when the default changes (e.g. user updates Settings drawer)
    useEffect(() => { setMessage(settings.message); }, [settings.message]);

    /* ── Share helper — tries Web Share API with file, otherwise falls back ── */
    async function shareOrFallback(
        blob: Blob,
        fallbackAction: () => void,
    ) {
        try {
            const file = new File([blob], 'quote.pdf', { type: 'application/pdf' });

            // Check if Web Share with files is supported
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: 'Quote',
                    text: message || t('actionButtons.defaultShareText'),
                    files: [file],
                });
                return; // shared successfully
            }
        } catch (err: unknown) {
            // User cancelled the share sheet — do nothing
            if (err instanceof Error && err.name === 'AbortError') return;
            console.warn('Web Share failed, using fallback:', err);
        }

        // Fallback: download PDF + open the appropriate link
        downloadPDF(blob, 'quote.pdf');
        fallbackAction();
    }

    /* ── Email handler ── */
    const handleEmail = async () => {
        const blob = await capturePDF();
        if (!blob) return;

        const subject = `${t('actionButtons.quoteFrom')} ${settings.companyName || 'Quote Flow'}`;
        const body = message || t('actionButtons.defaultEmailBody');
        const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        await shareOrFallback(blob, () => {
            window.location.href = mailtoUrl;
        });
    };

    /* ── Share handler ── */
    const handleShare = async () => {
        const blob = await capturePDF();
        if (!blob) return;

        await shareOrFallback(blob, () => {
            // Fallback: just download, no specific link
        });
    };

    /* ── WhatsApp handler ── */
    const handleWhatsapp = async () => {
        const blob = await capturePDF();
        if (!blob) return;

        const msg = message || t('actionButtons.defaultEmailBody');
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;

        await shareOrFallback(blob, () => {
            window.open(whatsappUrl, '_blank');
        });
    };

    return (
        <>
            {/* Action Buttons UI */}
            <div className={styles.actionSection}>
                <h2 className="shared-section-title">{t('actionButtons.predefinedMessage')}</h2>

                <div className={styles.messageGroup}>
                    <textarea
                        id="quote-message"
                        className="shared-textarea"
                        placeholder={t('actionButtons.messagePlaceholder')}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                    />
                    <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.35rem' }}>
                        {t('actionButtons.defaultSetInSettings')}
                    </p>
                </div>

                <h3 className="shared-subsection-title">{t('actionButtons.sendBy')}</h3>

                <div className={styles.buttonsGrid}>
                    <button
                        className={`${styles.actionBtn} ${styles.emailBtn}`}
                        onClick={handleEmail}
                        aria-label="Send via Email"
                    >
                        {t('actionButtons.email')}
                    </button>
                    <button
                        className={`${styles.actionBtn} ${styles.shareBtn}`}
                        onClick={handleShare}
                        aria-label="Share quote"
                    >
                        {t('actionButtons.share')}
                    </button>
                    <button
                        className={`${styles.actionBtn} ${styles.whatsappBtn}`}
                        onClick={handleWhatsapp}
                        aria-label="Send via Whatsapp"
                    >
                        {t('actionButtons.whatsapp')}
                    </button>
                </div>
            </div>
        </>
    );
}

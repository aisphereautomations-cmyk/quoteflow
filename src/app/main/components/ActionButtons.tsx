'use client';

import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { usePDF } from '../context/PDFContext';
import { downloadPDF } from '../utils/pdfGenerator';
import styles from './ActionButtons.module.css';

export default function ActionButtons() {
    const { settings } = useSettings();
    const { capturePDF } = usePDF();

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
                    text: settings.message || 'Please find the quote attached',
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

        const subject = `Quote from ${settings.companyName || 'Quote Flow'}`;
        const body = message || 'Hello! Please find attached the quote for your review.';
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

        const msg = message || 'Hello! Please find attached the quote for your review.';
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;

        await shareOrFallback(blob, () => {
            window.open(whatsappUrl, '_blank');
        });
    };

    return (
        <>
            {/* Action Buttons UI */}
            <div className={styles.actionSection}>
                <h2 className="shared-section-title">Pre-defined message</h2>

                <div className={styles.messageGroup}>
                    <textarea
                        id="quote-message"
                        className="shared-textarea"
                        placeholder="Message sent with the quote..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                    />
                    <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.35rem' }}>
                        Default set in Settings
                    </p>
                </div>

                <h3 className="shared-subsection-title">Send by:</h3>

                <div className={styles.buttonsGrid}>
                    <button
                        className={`${styles.actionBtn} ${styles.emailBtn}`}
                        onClick={handleEmail}
                        aria-label="Send via Email"
                    >
                        Email
                    </button>
                    <button
                        className={`${styles.actionBtn} ${styles.shareBtn}`}
                        onClick={handleShare}
                        aria-label="Share quote"
                    >
                        Share
                    </button>
                    <button
                        className={`${styles.actionBtn} ${styles.whatsappBtn}`}
                        onClick={handleWhatsapp}
                        aria-label="Send via Whatsapp"
                    >
                        Whatsapp
                    </button>
                </div>
            </div>
        </>
    );
}

'use client';

import { useState, useEffect } from 'react';
import { useClient } from '../context/ClientContext';
import { useSettings } from '../context/SettingsContext';
import { useQuote } from '../context/QuoteContext';
import { generateQuotePDF, downloadPDF } from '../utils/pdfGenerator';
import styles from './ActionButtons.module.css';

export default function ActionButtons() {
    const { client } = useClient();
    const { settings } = useSettings();
    const { quote } = useQuote();

    // Local editable messages — initialized from Settings defaults
    const [whatsappMsg, setWhatsappMsg] = useState(settings.whatsappMessage);
    const [emailMsg, setEmailMsg] = useState(settings.emailMessage);

    // Sync with settings when the default changes (e.g. user updates Settings drawer)
    useEffect(() => { setWhatsappMsg(settings.whatsappMessage); }, [settings.whatsappMessage]);
    useEffect(() => { setEmailMsg(settings.emailMessage); }, [settings.emailMessage]);

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
                    text: settings.emailMessage || client.serviceTitle || 'Please find the quote attached',
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
        if (!client.email) {
            alert('Please enter client email address');
            return;
        }

        const blob = await generateQuotePDF(settings, quote, client);

        const subject = `Quote from ${settings.companyName || 'Quote Flow'}`;
        const body = emailMsg || 'Hello! Please find attached the quote for your review.';
        const mailtoUrl = `mailto:${client.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        await shareOrFallback(blob, () => {
            window.location.href = mailtoUrl;
        });
    };

    /* ── Share handler ── */
    const handleShare = async () => {
        const blob = await generateQuotePDF(settings, quote, client);

        await shareOrFallback(blob, () => {
            // Fallback: just download, no specific link
        });
    };

    /* ── WhatsApp handler ── */
    const handleWhatsapp = async () => {
        if (!client.whatsapp) {
            alert('Please enter client WhatsApp number');
            return;
        }

        const blob = await generateQuotePDF(settings, quote, client);

        const message = whatsappMsg || 'Hello! Please find attached the quote for your review.';
        const phone = client.whatsapp.replace(/\D/g, ''); // Remove non-digits
        const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

        await shareOrFallback(blob, () => {
            window.open(whatsappUrl, '_blank');
        });
    };

    return (
        <>
            {/* Action Buttons UI */}
            <div className={styles.actionSection}>
                <h2 className="shared-section-title">Pre-defined messages</h2>

                <div className={styles.messageGroup}>
                    <label htmlFor="whatsapp-message" className={styles.label}>
                        Whatsapp:
                    </label>
                    <textarea
                        id="whatsapp-message"
                        className="shared-textarea"
                        placeholder="Custom message for Whatsapp..."
                        value={whatsappMsg}
                        onChange={(e) => setWhatsappMsg(e.target.value)}
                    />
                    <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.35rem' }}>
                        Default set in Settings
                    </p>
                </div>

                <div className={styles.messageGroup}>
                    <label htmlFor="email-message" className={styles.label}>
                        Email:
                    </label>
                    <textarea
                        id="email-message"
                        className="shared-textarea"
                        placeholder="Custom message for Email..."
                        value={emailMsg}
                        onChange={(e) => setEmailMsg(e.target.value)}
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

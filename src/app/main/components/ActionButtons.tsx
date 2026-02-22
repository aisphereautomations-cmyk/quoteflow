'use client';

import { useRef, useState, useEffect } from 'react';
import { useClient } from '../context/ClientContext';
import { useSettings } from '../context/SettingsContext';
import { useQuote } from '../context/QuoteContext';
import { generatePDF, downloadPDF } from '../utils/pdfGenerator';
import styles from './ActionButtons.module.css';

export default function ActionButtons() {
    const { client } = useClient();
    const { settings } = useSettings();
    const { quote } = useQuote();
    const previewRef = useRef<HTMLDivElement>(null);

    // Local editable messages — initialized from Settings defaults
    const [whatsappMsg, setWhatsappMsg] = useState(settings.whatsappMessage);
    const [emailMsg, setEmailMsg] = useState(settings.emailMessage);

    // Sync with settings when the default changes (e.g. user updates Settings drawer)
    useEffect(() => { setWhatsappMsg(settings.whatsappMessage); }, [settings.whatsappMessage]);
    useEffect(() => { setEmailMsg(settings.emailMessage); }, [settings.emailMessage]);

    const settingsVat = settings.vatEnabled ? settings.vatPercentage : 0;
    const vatPercent = quote.vatOverride !== '' ? (parseFloat(quote.vatOverride) || 0) : settingsVat;
    const baseVal = parseFloat(quote.baseValue) || 0;
    const totalValue = baseVal + (baseVal * vatPercent) / 100;

    // Only show services that have some content filled in
    const filledServices = quote.services.filter(
        (s) => s.title || s.description || s.fixedPrice || (s.quantity && s.unitPrice)
    );

    const handleEmail = async () => {
        if (!client.email) {
            alert('Please enter client email address');
            return;
        }

        if (!previewRef.current) return;

        try {
            // Generate and download PDF
            const blob = await generatePDF(previewRef.current, 'quote.pdf');
            downloadPDF(blob, 'quote.pdf');

            // Build mailto URL
            const subject = `Quote from ${settings.companyName || 'Quote Flow'}`;
            const body = emailMsg || 'Hello! Please find attached the quote for your review.';
            const mailtoUrl = `mailto:${client.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

            // Open email client
            window.location.href = mailtoUrl;
        } catch (error) {
            console.error('Error sending email:', error);
            alert('Failed to prepare email. Please try again.');
        }
    };

    const handleShare = async () => {
        if (!previewRef.current) return;

        try {
            // Generate PDF blob
            const blob = await generatePDF(previewRef.current, 'quote.pdf');

            // Check if Web Share API is supported
            if (navigator.share && navigator.canShare) {
                const file = new File([blob], 'quote.pdf', { type: 'application/pdf' });

                // Check if files can be shared
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: 'Quote',
                        text: settings.emailMessage || client.serviceTitle || 'Please find the quote attached',
                        files: [file],
                    });
                } else {
                    // Fallback to download if file sharing not supported
                    downloadPDF(blob, 'quote.pdf');
                    alert('PDF downloaded. File sharing is not supported on this browser.');
                }
            } else {
                // Fallback for unsupported browsers
                downloadPDF(blob, 'quote.pdf');
                alert('PDF downloaded. Web Share API is not supported on this browser.');
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                // User cancelled - do nothing
                return;
            }
            console.error('Error sharing:', error);
            // Fallback to download
            if (previewRef.current) {
                const blob = await generatePDF(previewRef.current, 'quote.pdf');
                downloadPDF(blob, 'quote.pdf');
            }
        }
    };

    const handleWhatsapp = async () => {
        if (!client.whatsapp) {
            alert('Please enter client WhatsApp number');
            return;
        }

        if (!previewRef.current) return;

        try {
            // Generate and download PDF
            const blob = await generatePDF(previewRef.current, 'quote.pdf');
            downloadPDF(blob, 'quote.pdf');

            // Build WhatsApp URL
            const message = whatsappMsg || 'Hello! Please find attached the quote for your review.';
            const phone = client.whatsapp.replace(/\D/g, ''); // Remove non-digits
            const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

            // Open WhatsApp
            window.open(whatsappUrl, '_blank');
        } catch (error) {
            console.error('Error sending WhatsApp:', error);
            alert('Failed to prepare WhatsApp message. Please try again.');
        }
    };

    return (
        <>
            {/* Hidden PDF Preview for generation */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                <div ref={previewRef} style={{ width: '794px', background: '#ffffff', padding: '20px' }}>
                    {/* PDF Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <div>
                            {settings.companyName && (
                                <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: 'bold', color: '#000' }}>
                                    {settings.companyName}
                                </h3>
                            )}
                            {settings.phone && (
                                <p style={{ margin: '5px 0', fontSize: '12px', color: '#333' }}>
                                    {settings.phone}
                                </p>
                            )}
                            {settings.email && (
                                <p style={{ margin: '5px 0', fontSize: '12px', color: '#333' }}>
                                    {settings.email}
                                </p>
                            )}
                            {settings.website && (
                                <p style={{ margin: '5px 0', fontSize: '12px', color: '#333' }}>
                                    {settings.website}
                                </p>
                            )}
                        </div>
                        {settings.logoUrl && (
                            <div style={{ width: '150px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <img src={settings.logoUrl} alt="Company logo" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                            </div>
                        )}
                    </div>

                    {/* Quote Description Bar */}
                    <div style={{ backgroundColor: settings.brandColor, color: '#fff', padding: '10px', marginBottom: '20px', fontWeight: 'bold' }}>
                        {settings.quoteDescription}
                    </div>

                    {/* Services */}
                    <div style={{ marginBottom: '20px' }}>
                        {filledServices.map((service) => {
                            let priceDisplay = '';

                            if (service.pricingMode === 'fixed') {
                                if (service.fixedPrice) {
                                    priceDisplay = `${parseFloat(service.fixedPrice).toFixed(2)} ${settings.currency}`;
                                }
                            } else if (service.quantity && service.unitPrice) {
                                const unit = service.pricingMode === 'sqm' ? 'm²' : 'hr';
                                const total = (
                                    parseFloat(service.quantity) *
                                    parseFloat(service.unitPrice)
                                ).toFixed(2);
                                priceDisplay = `${total} ${settings.currency} (${service.quantity} ${unit})`;
                            }

                            return (
                                <div key={service.id} style={{ marginBottom: '15px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                        {service.title && (
                                            <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#000' }}>
                                                {service.title}
                                            </span>
                                        )}
                                        {priceDisplay && (
                                            <span style={{ fontSize: '14px', color: '#000' }}>
                                                {priceDisplay}
                                            </span>
                                        )}
                                    </div>
                                    {service.description && (
                                        <p style={{ margin: '0', fontSize: '12px', color: '#555', lineHeight: '1.5' }}>
                                            {service.description}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Totals Divider Bar */}
                    <div style={{ backgroundColor: settings.brandColor, height: '3px', marginBottom: '20px' }}></div>

                    {/* Bottom Section */}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: '12px', color: '#555' }}>
                            <p style={{ margin: '5px 0' }}>
                                {quote.estimatedTime || 'Estimated time for execution'}
                            </p>
                            <p style={{ margin: '5px 0' }}>
                                {quote.expirationDate || 'Quote expiration date'}
                            </p>
                            <p style={{ margin: '5px 0' }}>
                                {quote.paymentConditions || 'Payment Conditions'}
                            </p>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '12px' }}>
                            <p style={{ margin: '5px 0', color: '#555' }}>
                                Price excluding VAT: {settings.currency}{' '}
                                {baseVal > 0 ? baseVal.toFixed(2) : '0.00'}
                            </p>
                            <p style={{ margin: '5px 0', color: '#555' }}>
                                VAT {vatPercent}%: {settings.currency}{' '}
                                {baseVal > 0 ? (totalValue - baseVal).toFixed(2) : '0.00'}
                            </p>
                            <p style={{ margin: '5px 0', fontWeight: 'bold', fontSize: '14px', color: '#000' }}>
                                Total incl. VAT: {settings.currency}{' '}
                                {totalValue > 0 ? totalValue.toFixed(2) : '0.00'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

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

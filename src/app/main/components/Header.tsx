'use client';

import { useQuote } from '../context/QuoteContext';
import { useClient } from '../context/ClientContext';
import { useTranslation } from '../context/LanguageContext';
import styles from './Header.module.css';

interface HeaderProps {
    onOpenSidebar: () => void;
}

export default function Header({ onOpenSidebar }: HeaderProps) {
    const { saveQuote, newQuote, isSaving, currentQuoteId } = useQuote();
    const { client, clearClient } = useClient();
    const { t } = useTranslation();

    const handleSave = async () => {
        try {
            await saveQuote(client.clientName, client.email, client.whatsapp, client.serviceTitle);
        } catch (err) {
            console.error('Error saving quote:', err);
        }
    };

    const handleNewQuote = () => {
        newQuote();
        clearClient();
    };

    return (
        <header className={styles.header}>
            <h1 className={styles.title}>{t('header.title')}</h1>

            <div className={styles.actions}>
                <button onClick={handleNewQuote} className={styles.actionBtn} title="New Quote">
                    {t('header.new')}
                </button>
                <button onClick={handleSave} className={styles.saveBtn} disabled={isSaving} title="Save Quote">
                    {isSaving ? '...' : '💾'}
                    {currentQuoteId && <span className={styles.savedDot}></span>}
                </button>
                <button onClick={onOpenSidebar} className={styles.menuBtn} title="Menu" aria-label="Open menu" data-tutorial="menu-button">
                    ☰
                </button>
            </div>
        </header>
    );
}

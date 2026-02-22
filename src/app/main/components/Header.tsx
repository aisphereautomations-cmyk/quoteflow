'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { useQuote } from '../context/QuoteContext';
import { useClient } from '../context/ClientContext';
import styles from './Header.module.css';

export default function Header() {
    const router = useRouter();
    const supabase = createClient();
    const { saveQuote, newQuote, loadQuote, deleteQuote, savedQuotes, isSaving, currentQuoteId } = useQuote();
    const { client, clearClient } = useClient();
    const [showHistory, setShowHistory] = useState(false);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
    };

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

    const handleLoadQuote = async (id: string) => {
        await loadQuote(id);
        setShowHistory(false);
    };

    return (
        <header className={styles.header}>
            <h1 className={styles.title}>Quote Flow</h1>

            <div className={styles.actions}>
                <button onClick={handleNewQuote} className={styles.actionBtn} title="New Quote">
                    ＋ New
                </button>
                <button onClick={handleSave} className={styles.saveBtn} disabled={isSaving} title="Save Quote">
                    {isSaving ? '...' : '💾'}
                    {currentQuoteId && <span className={styles.savedDot}></span>}
                </button>
                <div className={styles.historyWrapper}>
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className={styles.actionBtn}
                        title="Quote History"
                    >
                        📋
                    </button>
                    {showHistory && (
                        <div className={styles.historyDropdown}>
                            <div className={styles.historyHeader}>Saved Quotes</div>
                            {savedQuotes.length === 0 ? (
                                <div className={styles.historyEmpty}>No saved quotes yet</div>
                            ) : (
                                savedQuotes.map((q) => (
                                    <button
                                        key={q.id}
                                        className={`${styles.historyItem} ${q.id === currentQuoteId ? styles.historyItemActive : ''}`}
                                        onClick={() => handleLoadQuote(q.id)}
                                    >
                                        <div className={styles.historyContent}>
                                            <span className={styles.historyTitle}>{q.title}</span>
                                            <span className={styles.historyMeta}>
                                                {q.clientName && `${q.clientName} · `}
                                                {new Date(q.updatedAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <span
                                            className={styles.historyDelete}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (confirm('Delete this quote?')) deleteQuote(q.id);
                                            }}
                                            title="Delete quote"
                                        >
                                            ✕
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>
                <button onClick={handleLogout} className={styles.logoutBtn}>
                    Log out
                </button>
            </div>
        </header>
    );
}

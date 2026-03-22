'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { useQuote } from '../context/QuoteContext';
import { useClient } from '../context/ClientContext';
import { useChat } from '../context/ChatContext';
import { useTranslation } from '../context/LanguageContext';
import styles from './Sidebar.module.css';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const router = useRouter();
    const supabase = createClient();
    const { t } = useTranslation();
    const { saveQuote, newQuote, loadQuote, deleteQuote, renameQuote, savedQuotes, currentQuoteId } = useQuote();
    const { client, clearClient } = useClient();
    const {
        conversations,
        currentConversationId,
        sliders,
        setSliders,
        clearChat,
        loadConversation,
        deleteConversation,
        togglePin,
        renameConversation,
    } = useChat();

    // Inline rename state
    const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
    const [editingConvId, setEditingConvId] = useState<string | null>(null);

    // Section toggles
    const [showConversations, setShowConversations] = useState(true);
    const [showQuotes, setShowQuotes] = useState(true);
    const [showPreferences, setShowPreferences] = useState(false);

    const pinned = conversations.filter(c => c.isPinned);
    const recent = conversations.filter(c => !c.isPinned);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
    };

    const handleNewQuote = () => {
        newQuote();
        clearClient();
        onClose();
    };

    const handleNewChat = () => {
        clearChat();
        onClose();
    };

    const handleLoadQuote = async (id: string) => {
        await loadQuote(id);
        onClose();
    };

    const handleLoadConversation = (id: string) => {
        loadConversation(id);
        onClose();
    };

    const handleDeleteQuote = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm(t('header.deleteConfirm'))) {
            deleteQuote(id);
        }
    };

    const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm(t('sidebar.deleteConversation'))) {
            deleteConversation(id);
        }
    };

    const handleSave = async () => {
        try {
            await saveQuote(client.clientName, client.email, client.whatsapp, client.serviceTitle);
        } catch (err) {
            console.error('Error saving quote:', err);
        }
    };

    const getSliderLabel = (value: number, lowLabel: string, highLabel: string) => {
        if (value < 33) return lowLabel;
        if (value > 66) return highLabel;
        return t('sidebar.balanced');
    };

    const handleOpenSettings = () => {
        onClose();
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    };

    return (
        <>
            {/* Overlay */}
            {isOpen && <div className={styles.overlay} onClick={onClose} />}

            {/* Sidebar Panel */}
            <div className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
                {/* Header */}
                <div className={styles.sidebarHeader}>
                    <h2 className={styles.sidebarTitle}>{t('sidebar.menu')}</h2>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                <div className={styles.sidebarContent}>
                    {/* ── 💬 Conversations ── */}
                    <div className={styles.section}>
                        <button
                            className={styles.sectionHeader}
                            onClick={() => setShowConversations(!showConversations)}
                        >
                            <span>{t('sidebar.conversations')}</span>
                            <span className={styles.chevron}>{showConversations ? '▾' : '▸'}</span>
                        </button>

                        {showConversations && (
                            <div className={styles.sectionBody}>
                                <button className={styles.newBtn} onClick={handleNewChat}>
                                    + {t('sidebar.newChat')}
                                </button>

                                {conversations.length === 0 ? (
                                    <p className={styles.emptyText}>{t('sidebar.noConversations')}</p>
                                ) : (
                                    <>
                                        {pinned.length > 0 && (
                                            <div className={styles.subSection}>
                                                <p className={styles.subTitle}>📌 {t('sidebar.pinned')}</p>
                                                {pinned.map(c => (
                                                    <div
                                                        key={c.id}
                                                        className={`${styles.listItem} ${c.id === currentConversationId ? styles.active : ''}`}
                                                    >
                                                        {editingConvId === c.id ? (
                                                            <input
                                                                autoFocus
                                                                className={styles.renameInput}
                                                                defaultValue={c.title}
                                                                onBlur={(e) => {
                                                                    const val = e.target.value.trim();
                                                                    if (val && val !== c.title) renameConversation(c.id, val);
                                                                    setEditingConvId(null);
                                                                }}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        (e.target as HTMLInputElement).blur();
                                                                    }
                                                                    if (e.key === 'Escape') {
                                                                        setEditingConvId(null);
                                                                    }
                                                                }}
                                                            />
                                                        ) : (
                                                            <span
                                                                className={styles.itemTitle}
                                                                onClick={() => handleLoadConversation(c.id)}
                                                                onDoubleClick={() => setEditingConvId(c.id)}
                                                                title={t('sidebar.doubleClickRename')}
                                                            >
                                                                {c.title}
                                                            </span>
                                                        )}
                                                        <div className={styles.itemActions}>
                                                            <button onClick={() => togglePin(c.id)} title={t('sidebar.unpin')}>
                                                                📌
                                                            </button>
                                                            <button onClick={() => setEditingConvId(c.id)} title={t('sidebar.rename')}>
                                                                ✏️
                                                            </button>
                                                            <button
                                                                className={styles.deleteBtnX}
                                                                onClick={(e) => handleDeleteConversation(c.id, e)}
                                                                title={t('sidebar.delete')}
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {recent.length > 0 && (
                                            <div className={styles.subSection}>
                                                <p className={styles.subTitle}>{t('sidebar.recent')}</p>
                                                {recent.map(c => (
                                                    <div
                                                        key={c.id}
                                                        className={`${styles.listItem} ${c.id === currentConversationId ? styles.active : ''}`}
                                                    >
                                                        {editingConvId === c.id ? (
                                                            <input
                                                                autoFocus
                                                                className={styles.renameInput}
                                                                defaultValue={c.title}
                                                                onBlur={(e) => {
                                                                    const val = e.target.value.trim();
                                                                    if (val && val !== c.title) renameConversation(c.id, val);
                                                                    setEditingConvId(null);
                                                                }}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        (e.target as HTMLInputElement).blur();
                                                                    }
                                                                    if (e.key === 'Escape') {
                                                                        setEditingConvId(null);
                                                                    }
                                                                }}
                                                            />
                                                        ) : (
                                                            <span
                                                                className={styles.itemTitle}
                                                                onClick={() => handleLoadConversation(c.id)}
                                                                onDoubleClick={() => setEditingConvId(c.id)}
                                                                title={t('sidebar.doubleClickRename')}
                                                            >
                                                                {c.title}
                                                            </span>
                                                        )}
                                                        <div className={styles.itemActions}>
                                                            <button onClick={() => togglePin(c.id)} title={t('sidebar.pin')}>
                                                                📍
                                                            </button>
                                                            <button onClick={() => setEditingConvId(c.id)} title={t('sidebar.rename')}>
                                                                ✏️
                                                            </button>
                                                            <button
                                                                className={styles.deleteBtnX}
                                                                onClick={(e) => handleDeleteConversation(c.id, e)}
                                                                title={t('sidebar.delete')}
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── 📄 Quotes ── */}
                    <div className={styles.section}>
                        <button
                            className={styles.sectionHeader}
                            onClick={() => setShowQuotes(!showQuotes)}
                        >
                            <span>{t('sidebar.quotes')}</span>
                            <span className={styles.chevron}>{showQuotes ? '▾' : '▸'}</span>
                        </button>

                        {showQuotes && (
                            <div className={styles.sectionBody}>
                                <div className={styles.quoteActions}>
                                    <button className={styles.newBtn} onClick={handleNewQuote}>
                                        + {t('sidebar.newQuote')}
                                    </button>
                                    <button className={styles.saveBtn} onClick={handleSave}>
                                        💾 {t('sidebar.save')}
                                    </button>
                                </div>

                                {savedQuotes.length === 0 ? (
                                    <p className={styles.emptyText}>{t('header.noSavedQuotes')}</p>
                                ) : (
                                    savedQuotes.map((q) => (
                                        <div
                                            key={q.id}
                                            className={`${styles.listItem} ${q.id === currentQuoteId ? styles.active : ''}`}
                                        >
                                            {editingQuoteId === q.id ? (
                                                <input
                                                    autoFocus
                                                    className={styles.renameInput}
                                                    defaultValue={q.title}
                                                    onBlur={(e) => {
                                                        const val = e.target.value.trim();
                                                        if (val && val !== q.title) renameQuote(q.id, val);
                                                        setEditingQuoteId(null);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            (e.target as HTMLInputElement).blur();
                                                        }
                                                        if (e.key === 'Escape') {
                                                            setEditingQuoteId(null);
                                                        }
                                                    }}
                                                />
                                            ) : (
                                                <div className={styles.quoteItemContent} onClick={() => handleLoadQuote(q.id)}>
                                                    <span
                                                        className={styles.itemTitle}
                                                        onDoubleClick={() => setEditingQuoteId(q.id)}
                                                        title={t('sidebar.doubleClickRename')}
                                                    >
                                                        {q.title}
                                                    </span>
                                                    <span className={styles.itemMeta}>
                                                        {q.clientName && `${q.clientName} · `}
                                                        {new Date(q.updatedAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            )}
                                            <div className={styles.itemActions}>
                                                <button onClick={() => setEditingQuoteId(q.id)} title={t('sidebar.rename')}>
                                                    ✏️
                                                </button>
                                                <button
                                                    className={styles.deleteBtnX}
                                                    onClick={(e) => handleDeleteQuote(q.id, e)}
                                                    title={t('sidebar.delete')}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── 🎛️ AI Preferences ── */}
                    <div className={styles.section}>
                        <button
                            className={styles.sectionHeader}
                            onClick={() => setShowPreferences(!showPreferences)}
                        >
                            <span>{t('sidebar.aiPreferences')}</span>
                            <span className={styles.chevron}>{showPreferences ? '▾' : '▸'}</span>
                        </button>

                        {showPreferences && (
                            <div className={styles.sectionBody}>
                                <div className={styles.sliderRow}>
                                    <span className={styles.sliderLabel}>📝 {t('sidebar.detail')}</span>
                                    <div className={styles.sliderControl}>
                                        <div className={styles.sliderEnds}>
                                            <span>{t('sidebar.simple')}</span>
                                            <span className={styles.sliderCurrent}>
                                                {getSliderLabel(sliders.detail, t('sidebar.simple'), t('sidebar.detailed'))}
                                            </span>
                                            <span>{t('sidebar.detailed')}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={sliders.detail}
                                            onChange={(e) => setSliders({ ...sliders, detail: Number(e.target.value) })}
                                            className={styles.slider}
                                        />
                                    </div>
                                </div>
                                <div className={styles.sliderRow}>
                                    <span className={styles.sliderLabel}>💰 {t('sidebar.market')}</span>
                                    <div className={styles.sliderControl}>
                                        <div className={styles.sliderEnds}>
                                            <span>{t('sidebar.budget')}</span>
                                            <span className={styles.sliderCurrent}>
                                                {getSliderLabel(sliders.market, t('sidebar.budget'), t('sidebar.premium'))}
                                            </span>
                                            <span>{t('sidebar.premium')}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={sliders.market}
                                            onChange={(e) => setSliders({ ...sliders, market: Number(e.target.value) })}
                                            className={styles.slider}
                                        />
                                    </div>
                                </div>
                                <div className={styles.sliderRow}>
                                    <span className={styles.sliderLabel}>🎯 {t('sidebar.tone')}</span>
                                    <div className={styles.sliderControl}>
                                        <div className={styles.sliderEnds}>
                                            <span>{t('sidebar.casual')}</span>
                                            <span className={styles.sliderCurrent}>
                                                {getSliderLabel(sliders.tone, t('sidebar.casual'), t('sidebar.formal'))}
                                            </span>
                                            <span>{t('sidebar.formal')}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={sliders.tone}
                                            onChange={(e) => setSliders({ ...sliders, tone: Number(e.target.value) })}
                                            className={styles.slider}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── ⚙️ Settings ── */}
                    <button className={styles.settingsBtn} onClick={handleOpenSettings}>
                        {t('sidebar.settings')}
                    </button>
                </div>

                {/* Logout at bottom */}
                <div className={styles.sidebarFooter}>
                    <button className={styles.logoutBtn} onClick={handleLogout}>
                        {t('sidebar.logout')}
                    </button>
                </div>
            </div>
        </>
    );
}

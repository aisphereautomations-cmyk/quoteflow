'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { useQuote } from '../context/QuoteContext';
import { useClient } from '../context/ClientContext';
import { useChat } from '../context/ChatContext';
import { useTranslation } from '../context/LanguageContext';
import { useSubscription } from '@/app/context/SubscriptionContext';
import { getPlan } from '@/lib/plans';
import styles from './Sidebar.module.css';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const router = useRouter();
    const supabase = createClient();
    const { t } = useTranslation();
    const { subscription } = useSubscription();
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

                    {/* ── 📊 Media Usage ── */}
                    {subscription && (() => {
                        const planConfig = getPlan(subscription.plan);
                        const ml = planConfig.features.mediaLimits;
                        const photoUsed = subscription.mediaUsage?.photoUploadsUsed || 0;
                        const docUsed = subscription.mediaUsage?.docUploadsUsed || 0;
                        const photoPct = Math.min(100, Math.round((photoUsed / ml.photoUploadsPerMonth) * 100));
                        const docPct = Math.min(100, Math.round((docUsed / ml.docUploadsPerMonth) * 100));
                        return (
                            <div className={styles.usageSection}>
                                <span className={styles.usageTitle}>{t('sidebar.mediaUsage')}</span>
                                <div className={styles.usageRow}>
                                    <span className={styles.usageLabel}>📷 {photoUsed}/{ml.photoUploadsPerMonth}</span>
                                    <div className={styles.usageBar}>
                                        <div
                                            className={`${styles.usageBarFill} ${photoPct >= 90 ? styles.usageBarDanger : ''}`}
                                            style={{ width: `${photoPct}%` }}
                                        />
                                    </div>
                                </div>
                                <div className={styles.usageRow}>
                                    <span className={styles.usageLabel}>📄 {docUsed}/{ml.docUploadsPerMonth}</span>
                                    <div className={styles.usageBar}>
                                        <div
                                            className={`${styles.usageBarFill} ${docPct >= 90 ? styles.usageBarDanger : ''}`}
                                            style={{ width: `${docPct}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* ── Upgrade (visible for starter/pro) ── */}
                    <UpgradeButton />

                    {/* ── Help ── */}
                    <HelpButton />
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

/* ── Upgrade Button Component ── */
function UpgradeButton() {
    const { subscription } = useSubscription();
    const { t } = useTranslation();
    const router = useRouter();

    // Only show for starter and pro plans
    const plan = subscription?.plan;
    if (!plan || plan === 'enterprise') return null;

    return (
        <button
            className={styles.upgradeBtn}
            onClick={() => router.push('/pricing')}
        >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5" />
                <path d="m5 12 7-7 7 7" />
            </svg>
            {t('sidebar.upgrade')}
        </button>
    );
}

/* ── Help Button Component ── */
function HelpButton() {
    const { subscription } = useSubscription();
    const { t } = useTranslation();
    const [showPopover, setShowPopover] = useState(false);

    const planId = subscription?.plan || 'starter';
    const plan = getPlan(planId);
    const support = plan.features.support;

    return (
        <div className={styles.helpWrapper}>
            <button
                className={styles.helpBtn}
                onClick={() => setShowPopover(!showPopover)}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                {t('sidebar.help')}
            </button>

            <a href="/privacy" target="_blank" rel="noopener noreferrer" className={styles.helpBtn} style={{ textDecoration: 'none' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                {t('login.privacyPolicy')}
            </a>
            {showPopover && (
                <div className={styles.helpPopover}>
                    <div className={styles.helpPopoverHeader}>
                        {t('sidebar.help')} — {plan.name}
                    </div>
                    <div className={styles.helpChannels}>
                        <a href={`mailto:${support.email}`} className={styles.helpChannel}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                            Email
                        </a>
                        {support.whatsapp && (
                            <a href={`https://wa.me/${support.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className={styles.helpChannel}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.553 4.117 1.521 5.853L0 24l6.335-1.492A11.924 11.924 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-1.884 0-3.672-.499-5.25-1.417l-.375-.225-3.896.918.975-3.792-.246-.39A9.704 9.704 0 012.25 12 9.75 9.75 0 0112 2.25 9.75 9.75 0 0121.75 12 9.75 9.75 0 0112 21.75z" /></svg>
                                WhatsApp
                            </a>
                        )}
                        {support.phone && (
                            <a href={`tel:${support.phone}`} className={styles.helpChannel}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                                {support.phone}
                            </a>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

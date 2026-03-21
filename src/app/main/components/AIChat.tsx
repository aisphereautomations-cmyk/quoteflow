'use client';

import { useState, useEffect, useRef } from 'react';
import { useChat } from '../context/ChatContext';
import { useTranslation } from '../context/LanguageContext';
import styles from './AIChat.module.css';

export default function AIChat() {
    const {
        messages,
        isLoading,
        error,
        pendingQuoteData,
        sliders,
        conversations,
        currentConversationId,
        sendMessage,
        applyQuoteData,
        dismissQuoteData,
        setSliders,
        clearChat,
        loadConversation,
        deleteConversation,
        togglePin,
    } = useChat();
    const { t, locale } = useTranslation();

    const [isExpanded, setIsExpanded] = useState(false);
    const [input, setInput] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showSliders, setShowSliders] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Auto-scroll to latest message
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isLoading]);

    const toggleExpand = () => setIsExpanded(!isExpanded);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;
        const text = input;
        setInput('');
        await sendMessage(text);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleFillQuote = () => applyQuoteData();

    const handleNewChat = () => {
        clearChat();
        setShowHistory(false);
    };

    /* ── Voice Input (MediaRecorder → OpenAI Whisper) ── */
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunksRef.current = [];

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                    ? 'audio/webm;codecs=opus'
                    : 'audio/webm',
            });

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                // Stop all tracks so the browser releases the mic
                stream.getTracks().forEach(track => track.stop());

                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                audioChunksRef.current = [];

                if (audioBlob.size < 100) return; // Too small, probably empty

                // Send to Whisper API for transcription
                setIsTranscribing(true);
                try {
                    const formData = new FormData();
                    formData.append('file', audioBlob, 'audio.webm');
                    // Pass user's language for better Whisper accuracy
                    const whisperLang = locale.startsWith('pt') ? 'pt' : locale;
                    formData.append('language', whisperLang);

                    const res = await fetch('/api/transcribe', {
                        method: 'POST',
                        body: formData,
                    });

                    const data = await res.json();
                    if (!res.ok) throw new Error(data.message || data.error || 'Transcription failed');

                    if (data.text && data.text.trim()) {
                        // Populate input for review — user can edit before sending
                        setInput(data.text.trim());
                    }
                } catch (err) {
                    console.error('Transcription error:', err);
                    alert(t('aiChat.speechNotSupported'));
                } finally {
                    setIsTranscribing(false);
                }
            };

            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start();
            setIsRecording(true);

            // Auto-stop after 30 seconds to avoid huge files
            recordingTimeoutRef.current = setTimeout(() => {
                stopRecording();
            }, 30000);
        } catch (err) {
            console.error('Microphone access error:', err);
            alert(t('aiChat.micDenied'));
        }
    };

    const stopRecording = () => {
        if (recordingTimeoutRef.current) {
            clearTimeout(recordingTimeoutRef.current);
            recordingTimeoutRef.current = null;
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
    };

    const handleMicClick = () => {
        if (isRecording) {
            stopRecording();
        } else if (!isTranscribing) {
            startRecording();
        }
    };

    /* ── Slider Labels ── */
    const getSliderLabel = (value: number, lowLabel: string, highLabel: string) => {
        if (value < 33) return lowLabel;
        if (value > 66) return highLabel;
        return 'Balanced';
    };

    /* ── Pinned & Recent split ── */
    const pinned = conversations.filter(c => c.isPinned);
    const recent = conversations.filter(c => !c.isPinned);

    return (
        <>
            <div className={`${styles.chatContainer} ${isExpanded ? styles.expanded : styles.collapsed}`}>
                {/* Header */}
                <div className={styles.chatHeader}>
                    <span onClick={toggleExpand}>{t('aiChat.chatHeader')}</span>
                    <div className={styles.headerActions}>
                        <button
                            className={styles.headerBtn}
                            onClick={() => { setShowSliders(!showSliders); setShowHistory(false); }}
                            title="AI Preferences"
                        >
                            ⚙️
                        </button>
                        <button
                            className={styles.headerBtn}
                            onClick={() => { setShowHistory(!showHistory); setShowSliders(false); }}
                            title="Chat History"
                        >
                            📋
                        </button>
                        <button
                            className={styles.headerBtn}
                            onClick={handleNewChat}
                            title="New Chat"
                        >
                            ＋
                        </button>
                        {isExpanded && (
                            <button className={styles.headerBtn} onClick={toggleExpand}>
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* Sliders Panel */}
                {showSliders && (
                    <div className={styles.slidersPanel}>
                        <div className={styles.sliderRow}>
                            <span className={styles.sliderIcon}>📝</span>
                            <div className={styles.sliderControl}>
                                <div className={styles.sliderLabels}>
                                    <span>Simple</span>
                                    <span className={styles.sliderCurrentLabel}>
                                        {getSliderLabel(sliders.detail, 'Simple', 'Detailed')}
                                    </span>
                                    <span>Detailed</span>
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
                            <span className={styles.sliderIcon}>💰</span>
                            <div className={styles.sliderControl}>
                                <div className={styles.sliderLabels}>
                                    <span>Budget</span>
                                    <span className={styles.sliderCurrentLabel}>
                                        {getSliderLabel(sliders.market, 'Budget', 'Premium')}
                                    </span>
                                    <span>Premium</span>
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
                            <span className={styles.sliderIcon}>🎯</span>
                            <div className={styles.sliderControl}>
                                <div className={styles.sliderLabels}>
                                    <span>Casual</span>
                                    <span className={styles.sliderCurrentLabel}>
                                        {getSliderLabel(sliders.tone, 'Casual', 'Formal')}
                                    </span>
                                    <span>Formal</span>
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

                {/* History Panel */}
                {showHistory && (
                    <div className={styles.historyPanel}>
                        {conversations.length === 0 ? (
                            <p className={styles.historyEmpty}>No conversations yet</p>
                        ) : (
                            <>
                                {pinned.length > 0 && (
                                    <div className={styles.historySection}>
                                        <p className={styles.historySectionTitle}>📌 Pinned</p>
                                        {pinned.map(c => (
                                            <div
                                                key={c.id}
                                                className={`${styles.historyItem} ${c.id === currentConversationId ? styles.historyItemActive : ''}`}
                                            >
                                                <span
                                                    className={styles.historyItemTitle}
                                                    onClick={() => { loadConversation(c.id); setShowHistory(false); }}
                                                >
                                                    {c.title}
                                                </span>
                                                <div className={styles.historyItemActions}>
                                                    <button onClick={() => togglePin(c.id)} title="Unpin">📌</button>
                                                    <button onClick={() => deleteConversation(c.id)} title="Delete">🗑</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {recent.length > 0 && (
                                    <div className={styles.historySection}>
                                        <p className={styles.historySectionTitle}>Recent</p>
                                        {recent.map(c => (
                                            <div
                                                key={c.id}
                                                className={`${styles.historyItem} ${c.id === currentConversationId ? styles.historyItemActive : ''}`}
                                            >
                                                <span
                                                    className={styles.historyItemTitle}
                                                    onClick={() => { loadConversation(c.id); setShowHistory(false); }}
                                                >
                                                    {c.title}
                                                </span>
                                                <div className={styles.historyItemActions}>
                                                    <button onClick={() => togglePin(c.id)} title="Pin">📍</button>
                                                    <button onClick={() => deleteConversation(c.id)} title="Delete">🗑</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Messages */}
                <div className={styles.chatMessages}>
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`${styles.message} ${msg.role === 'assistant' ? styles.botMessage : styles.userMessage}`}
                        >
                            {msg.content}
                        </div>
                    ))}
                    {isLoading && (
                        <div className={`${styles.message} ${styles.botMessage}`}>
                            <span className={styles.loadingDots}>{t('aiChat.thinking')}</span>
                        </div>
                    )}
                    {error && <div className={styles.errorMessage}>{error}</div>}

                    {pendingQuoteData && (
                        <div className={styles.quoteReadyBanner}>
                            <span>{t('aiChat.quoteReady')}</span>
                            <div className={styles.quoteReadyActions}>
                                <button className={styles.fillQuoteSmallBtn} onClick={handleFillQuote}>
                                    {t('aiChat.apply')}
                                </button>
                                <button className={styles.dismissBtn} onClick={dismissQuoteData}>✕</button>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className={styles.inputArea}>
                    <div className={styles.inputWrapper}>
                        <input
                            type="text"
                            placeholder={t('aiChat.inputPlaceholder')}
                            className={styles.chatInput}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyPress}
                            disabled={isLoading}
                            aria-label="Chat message"
                        />
                        <button
                            className={styles.sendBtn}
                            onClick={handleSend}
                            disabled={isLoading || !input.trim()}
                            aria-label="Send message"
                        >
                            ↑
                        </button>
                    </div>
                    <button
                        className={`${styles.micBtn} ${isRecording ? styles.micRecording : ''} ${isTranscribing ? styles.micTranscribing : ''}`}
                        onClick={handleMicClick}
                        disabled={isTranscribing}
                        aria-label={isRecording ? 'Stop recording' : isTranscribing ? 'Transcribing...' : 'Start voice input'}
                    >
                        {isRecording ? '⏹' : isTranscribing ? '⏳' : '🎤'}
                    </button>
                </div>
            </div>

            {!isExpanded && (
                <div className={styles.actionArea}>
                    <div className={styles.actionMain}>
                        <button
                            className={`${styles.fillQuoteBtn} ${pendingQuoteData ? styles.fillQuoteBtnReady : styles.fillQuoteBtnDimmed}`}
                            onClick={pendingQuoteData ? handleFillQuote : undefined}
                            disabled={!pendingQuoteData}
                        >
                            {t('aiChat.fillQuoteWithAi')}
                        </button>
                        {!pendingQuoteData && (
                            <p className={styles.actionHint}>{t('aiChat.chatFirstHint')}</p>
                        )}
                    </div>
                    <button
                        className={styles.expandBtn}
                        onClick={toggleExpand}
                        aria-label="Expand chat"
                    >
                        ⛶
                    </button>
                </div>
            )}
        </>
    );
}

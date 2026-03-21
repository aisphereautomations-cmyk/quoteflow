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
        sendMessage,
        applyQuoteData,
        dismissQuoteData,
        clearChat,
    } = useChat();
    const { t, locale } = useTranslation();

    const [isExpanded, setIsExpanded] = useState(false);
    const [input, setInput] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
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

    return (
        <>
            <div className={`${styles.chatContainer} ${isExpanded ? styles.expanded : styles.collapsed}`}>
                {/* Header */}
                <div className={styles.chatHeader}>
                    <span onClick={toggleExpand}>{t('aiChat.chatHeader')}</span>
                    <div className={styles.headerActions}>
                        {isExpanded && (
                            <button className={styles.headerBtn} onClick={toggleExpand}>
                                ✕
                            </button>
                        )}
                    </div>
                </div>

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

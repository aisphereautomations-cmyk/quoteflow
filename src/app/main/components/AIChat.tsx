'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { useChat } from '../context/ChatContext';
import { useTranslation } from '../context/LanguageContext';
import styles from './AIChat.module.css';

/* ── SVG Icons ── */
const MicIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
);

const StopIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
);

const SpinnerIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
);

const PaperclipIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
);

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
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const [attachPreviews, setAttachPreviews] = useState<{url: string; name: string; type: string}[]>([]);

    // ── Keep expanded chat above mobile keyboard (visualViewport API) ──
    useEffect(() => {
        if (!isExpanded) return;

        // Lock background scroll while fullscreen chat is open
        document.body.style.overflow = 'hidden';

        const vv = window.visualViewport;
        if (!vv) return () => { document.body.style.overflow = ''; };

        const syncHeight = () => {
            // visualViewport.height = visible area excluding keyboard
            const h = vv.height;
            document.documentElement.style.setProperty('--chat-vh', `${h}px`);

            // On iOS Safari the viewport may also shift; reset scroll
            window.scrollTo(0, 0);
        };

        // Set initial value
        syncHeight();

        vv.addEventListener('resize', syncHeight);
        vv.addEventListener('scroll', syncHeight);

        return () => {
            vv.removeEventListener('resize', syncHeight);
            vv.removeEventListener('scroll', syncHeight);
            document.documentElement.style.removeProperty('--chat-vh');
            document.body.style.overflow = '';
        };
    }, [isExpanded]);

    // Auto-scroll to latest message (within chat only, not the page)
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }, [messages, isLoading]);

    // Auto-resize textarea
    const resizeTextarea = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    }, []);

    useEffect(() => {
        resizeTextarea();
    }, [input, resizeTextarea]);

    const toggleExpand = () => setIsExpanded(!isExpanded);

    const handleSend = async () => {
        if ((!input.trim() && attachedFiles.length === 0) || isLoading) return;
        const text = input;
        const files = attachedFiles.length > 0 ? [...attachedFiles] : undefined;
        setInput('');
        setAttachedFiles([]);
        setAttachPreviews([]);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
        await sendMessage(text, files);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleAttach = () => {
        fileInputRef.current?.click();
    };

    const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const newFiles = [...attachedFiles, ...files].slice(0, 5); // Max 5 files per message
        setAttachedFiles(newFiles);

        // Generate previews
        const previews = newFiles.map(f => ({
            url: f.type.startsWith('image/') ? URL.createObjectURL(f) : '',
            name: f.name,
            type: f.type,
        }));
        setAttachPreviews(previews);

        // Reset input so same file can be selected again
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeAttachment = (index: number) => {
        const newFiles = attachedFiles.filter((_, i) => i !== index);
        setAttachedFiles(newFiles);
        // Revoke old ObjectURL
        if (attachPreviews[index]?.url) URL.revokeObjectURL(attachPreviews[index].url);
        setAttachPreviews(attachPreviews.filter((_, i) => i !== index));
    };

    const handleFillQuote = () => applyQuoteData();

    const handleNewChat = () => clearChat();

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
                stream.getTracks().forEach(track => track.stop());

                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                audioChunksRef.current = [];

                if (audioBlob.size < 100) return;

                setIsTranscribing(true);
                try {
                    const formData = new FormData();
                    formData.append('file', audioBlob, 'audio.webm');
                    const whisperLang = locale.startsWith('pt') ? 'pt' : locale;
                    formData.append('language', whisperLang);

                    const res = await fetch('/api/transcribe', {
                        method: 'POST',
                        body: formData,
                    });

                    const data = await res.json();
                    if (!res.ok) throw new Error(data.message || data.error || 'Transcription failed');

                    if (data.text && data.text.trim()) {
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
                    <span className={styles.headerTitle} onClick={toggleExpand}>
                        {t('aiChat.chatHeader')}
                    </span>
                    <div className={styles.headerActions}>
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

                {/* Messages */}
                <div className={styles.chatMessages} ref={messagesContainerRef}>
                    <div className={styles.messagesInner}>
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`${styles.messageRow} ${msg.role === 'assistant' ? styles.botRow : styles.userRow}`}
                            >
                                {msg.role === 'assistant' && (
                                    <div className={`${styles.avatar} ${styles.botAvatar}`}>✨</div>
                                )}
                                <div className={`${styles.messageContent} ${msg.role === 'assistant' ? styles.botMessage : styles.userMessage}`}>
                                    {msg.role === 'user' && msg.attachments && msg.attachments.length > 0 && (
                                        <div className={styles.msgAttachments}>
                                            {msg.attachments.map((att, i) => (
                                                att.type === 'photo' ? (
                                                    <img key={i} src={att.dataUrl} alt={att.name} className={styles.msgAttachImg} />
                                                ) : (
                                                    <div key={i} className={styles.msgAttachDoc}>
                                                        <span className={styles.docIcon}>📄</span>
                                                        <span className={styles.docName}>{att.name}</span>
                                                    </div>
                                                )
                                            ))}
                                        </div>
                                    )}
                                    {msg.role === 'assistant' ? (
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    ) : (
                                        msg.content
                                    )}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className={`${styles.messageRow} ${styles.botRow}`}>
                                <div className={`${styles.avatar} ${styles.botAvatar}`}>✨</div>
                                <div className={`${styles.messageContent} ${styles.botMessage}`}>
                                    <span className={styles.loadingDots}>
                                        <span></span><span></span><span></span>
                                    </span>
                                </div>
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
                </div>

                {/* Input */}
                <div className={styles.inputArea}>
                    {/* Attachment preview strip */}
                    {attachPreviews.length > 0 && (
                        <div className={styles.attachPreview}>
                            {attachPreviews.map((p, i) => (
                                <div key={i} className={styles.attachPreviewItem}>
                                    {p.type.startsWith('image/') ? (
                                        <img src={p.url} alt={p.name} className={styles.attachThumb} />
                                    ) : (
                                        <div className={styles.attachDocThumb}>
                                            <span>📄</span>
                                            <span className={styles.attachDocName}>{p.name.length > 12 ? p.name.slice(0, 10) + '…' : p.name}</span>
                                        </div>
                                    )}
                                    <button className={styles.attachRemove} onClick={() => removeAttachment(i)}>✕</button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className={styles.inputWrapper}>
                        <textarea
                            ref={textareaRef}
                            placeholder={t('aiChat.inputPlaceholder')}
                            className={styles.chatInput}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isLoading}
                            aria-label="Chat message"
                            rows={2}
                        />
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,.pdf"
                            multiple
                            style={{ display: 'none' }}
                            onChange={handleFilesSelected}
                        />
                        <div className={styles.inputActions}>
                            <button
                                className={styles.attachBtn}
                                onClick={handleAttach}
                                disabled={isLoading}
                                aria-label="Attach files"
                                title={t('aiChat.attachFile') || 'Attach photo or document'}
                            >
                                <PaperclipIcon />
                            </button>
                            <button
                                className={`${styles.micBtn} ${isRecording ? styles.micRecording : ''} ${isTranscribing ? styles.micTranscribing : ''}`}
                                onClick={handleMicClick}
                                disabled={isTranscribing}
                                aria-label={isRecording ? 'Stop recording' : isTranscribing ? 'Transcribing...' : 'Start voice input'}
                            >
                                {isRecording ? <StopIcon /> : isTranscribing ? <SpinnerIcon /> : <MicIcon />}
                            </button>
                            <button
                                className={styles.sendBtn}
                                onClick={handleSend}
                                disabled={isLoading || (!input.trim() && attachedFiles.length === 0)}
                                aria-label="Send message"
                            >
                                ↑
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {!isExpanded && (
                <>
                    <div className={styles.actionArea}>
                        <button
                            className={`${styles.fillQuoteBtn} ${pendingQuoteData ? styles.fillQuoteBtnReady : styles.fillQuoteBtnDimmed}`}
                            onClick={pendingQuoteData ? handleFillQuote : undefined}
                            disabled={!pendingQuoteData}
                        >
                            {t('aiChat.fillQuoteWithAi')}
                        </button>
                        <button
                            className={styles.expandBtn}
                            onClick={toggleExpand}
                            aria-label="Expand chat"
                        >
                            ⛶
                        </button>
                    </div>
                    {!pendingQuoteData && (
                        <div className={styles.hintGroup}>
                            <p className={styles.actionHint}>{t('aiChat.chatFirstHint')}</p>
                            <p className={styles.aiDisclaimer}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                {t('aiChat.aiDisclaimer')}
                            </p>
                        </div>
                    )}
                </>
            )}
        </>
    );
}

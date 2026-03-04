'use client';

import { useState, useEffect, useRef } from 'react';
import { useChat } from '../context/ChatContext';
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
    } = useChat();

    const [isExpanded, setIsExpanded] = useState(false);
    const [input, setInput] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognitionRef = useRef<any>(null);

    // Auto-scroll to latest message
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isLoading]);

    const toggleExpand = () => {
        setIsExpanded(!isExpanded);
    };

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

    const handleFillQuote = () => {
        applyQuoteData();
    };

    /* ── Voice Input (Web Speech API) ── */
    const startRecording = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any;
        const SpeechRecognitionAPI = w.SpeechRecognition || w.webkitSpeechRecognition;

        if (!SpeechRecognitionAPI) {
            alert('Speech recognition is not supported in this browser. Try Chrome or Safari.');
            return;
        }

        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = false;
        recognition.interimResults = false;
        // Empty string = auto-detect language
        recognition.lang = '';

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            if (transcript.trim()) {
                setInput(transcript);
                // Auto-send after transcription
                sendMessage(transcript.trim());
            }
            setIsRecording(false);
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            setIsRecording(false);
            if (event.error === 'not-allowed') {
                alert('Microphone access was denied. Please allow microphone access in your browser settings.');
            }
        };

        recognition.onend = () => {
            setIsRecording(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsRecording(true);
    };

    const stopRecording = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleMicClick = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    return (
        <>
            <div className={`${styles.chatContainer} ${isExpanded ? styles.expanded : styles.collapsed}`}>
                <div className={styles.chatHeader} onClick={toggleExpand}>
                    <span>Chat with AI To Help you Quote</span>
                    {isExpanded && <span>✕</span>}
                </div>

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
                            <span className={styles.loadingDots}>Thinking...</span>
                        </div>
                    )}
                    {error && <div className={styles.errorMessage}>{error}</div>}

                    {/* Quote Ready Banner */}
                    {pendingQuoteData && (
                        <div className={styles.quoteReadyBanner}>
                            <span>✨ Quote ready to fill!</span>
                            <div className={styles.quoteReadyActions}>
                                <button
                                    className={styles.fillQuoteSmallBtn}
                                    onClick={handleFillQuote}
                                >
                                    Apply
                                </button>
                                <button
                                    className={styles.dismissBtn}
                                    onClick={dismissQuoteData}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                <div className={styles.inputArea}>
                    <div className={styles.inputWrapper}>
                        <input
                            type="text"
                            placeholder="Let's Chat"
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
                        className={`${styles.micBtn} ${isRecording ? styles.micRecording : ''}`}
                        onClick={handleMicClick}
                        aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
                    >
                        {isRecording ? '⏹' : '🎤'}
                    </button>
                </div>
            </div>

            {!isExpanded && (
                <div className={styles.actionArea}>
                    <button
                        className={`${styles.fillQuoteBtn} ${pendingQuoteData ? styles.fillQuoteBtnReady : ''}`}
                        onClick={pendingQuoteData ? handleFillQuote : toggleExpand}
                    >
                        {pendingQuoteData
                            ? '✨ Apply AI Quote'
                            : 'Fill Quote with the AI chat'}
                    </button>
                </div>
            )}
        </>
    );
}

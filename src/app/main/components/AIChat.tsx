'use client';

import { useState } from 'react';
import styles from './AIChat.module.css';

interface Message {
    id: string;
    text: string;
    isBot: boolean;
}

export default function AIChat() {
    const [isExpanded, setIsExpanded] = useState(false);
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            text: 'Hey, What are we gone quote today?',
            isBot: true,
        },
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const toggleExpand = () => {
        setIsExpanded(!isExpanded);
    };

    const handleSend = async () => {
        if (!message.trim()) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            text: message,
            isBot: false,
        };

        setMessages((prev) => [...prev, userMessage]);
        setMessage('');
        setIsLoading(true);
        setError('');

        try {
            // TODO: Replace with actual AI API call
            await new Promise((resolve) => setTimeout(resolve, 1000));

            const botResponse: Message = {
                id: (Date.now() + 1).toString(),
                text: 'This is a placeholder response. AI integration coming soon!',
                isBot: true,
            };

            setMessages((prev) => [...prev, botResponse]);
        } catch (err) {
            setError('Failed to send message. Please try again.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
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
                            className={`${styles.message} ${msg.isBot ? styles.botMessage : styles.userMessage}`}
                        >
                            {msg.text}
                        </div>
                    ))}
                    {isLoading && (
                        <div className={`${styles.message} ${styles.botMessage}`}>
                            <span className={styles.loadingDots}>Thinking...</span>
                        </div>
                    )}
                    {error && <div className={styles.errorMessage}>{error}</div>}
                </div>

                <div className={styles.inputArea}>
                    <div className={styles.inputWrapper}>
                        <input
                            type="text"
                            placeholder="Let's Chat"
                            className={styles.chatInput}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={handleKeyPress}
                            disabled={isLoading}
                            aria-label="Chat message"
                        />
                        <button
                            className={styles.sendBtn}
                            onClick={handleSend}
                            disabled={isLoading || !message.trim()}
                            aria-label="Send message"
                        >
                            ↑
                        </button>
                    </div>
                    <button className={styles.micBtn} aria-label="Voice input (coming soon)">
                        🎤
                    </button>
                </div>
            </div>

            {!isExpanded && (
                <div className={styles.actionArea}>
                    <button className={styles.fillQuoteBtn}>Fill Quote with the AI chat</button>
                </div>
            )}
        </>
    );
}

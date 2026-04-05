'use client';

import { useState, useCallback } from 'react';
import styles from './page.module.css';
import Header from './components/Header';
import AIChat from './components/AIChat';
import Notepad from './components/Notepad';
import Sidebar from './components/Sidebar';
import QuoteForm from './components/QuoteForm';
import PDFPreview from './components/PDFPreview';
import ActionButtons from './components/ActionButtons';
import SettingsDrawer from './components/SettingsDrawer';
import TutorialOverlay from './components/TutorialOverlay';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { LanguageProvider } from './context/LanguageContext';
import { QuoteProvider } from './context/QuoteContext';
import { ClientProvider } from './context/ClientContext';
import { PDFProvider } from './context/PDFContext';
import { ChatProvider } from './context/ChatContext';
import { SubscriptionProvider } from '@/app/context/SubscriptionContext';

const showAIChat = process.env.NEXT_PUBLIC_ENABLE_AI_CHAT === 'true';

function MainContent() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);

    const handleReplayTutorial = useCallback(() => {
        setSidebarOpen(false);
        setShowTutorial(true);
    }, []);

    const handleTutorialConsumed = useCallback(() => {
        setShowTutorial(false);
    }, []);

    return (
        <main className={styles.mainContainer}>
            <Header onOpenSidebar={() => setSidebarOpen(true)} />
            {showAIChat && <Notepad />}
            {showAIChat && <AIChat />}
            <QuoteForm />
            <PDFPreview />
            <ActionButtons />
            <SettingsDrawer />
            <Sidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                onReplayTutorial={handleReplayTutorial}
            />
            <TutorialOverlay
                forceShow={showTutorial}
                onForceShowConsumed={handleTutorialConsumed}
                onOpenSidebar={() => setSidebarOpen(true)}
                onCloseSidebar={() => setSidebarOpen(false)}
            />
        </main>
    );
}

export default function MainPage() {
    return (
        <AuthProvider>
            <SettingsProvider>
                <LanguageProvider>
                    <SubscriptionProvider>
                        <QuoteProvider>
                            <ClientProvider>
                                <PDFProvider>
                                    <ChatProvider>
                                        <MainContent />
                                    </ChatProvider>
                                </PDFProvider>
                            </ClientProvider>
                        </QuoteProvider>
                    </SubscriptionProvider>
                </LanguageProvider>
            </SettingsProvider>
        </AuthProvider>
    );
}

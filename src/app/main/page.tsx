'use client';

import styles from './page.module.css';
import Header from './components/Header';
import AIChat from './components/AIChat';
import QuoteForm from './components/QuoteForm';
import ClientInfo from './components/ClientInfo';
import PDFPreview from './components/PDFPreview';
import ActionButtons from './components/ActionButtons';
import SettingsDrawer from './components/SettingsDrawer';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { QuoteProvider } from './context/QuoteContext';
import { ClientProvider } from './context/ClientContext';

export default function MainPage() {
    return (
        <AuthProvider>
            <SettingsProvider>
                <QuoteProvider>
                    <ClientProvider>
                        <main className={styles.mainContainer}>
                            <Header />
                            <AIChat />
                            <QuoteForm />
                            <PDFPreview />
                            <ClientInfo />
                            <ActionButtons />
                            <SettingsDrawer />
                        </main>
                    </ClientProvider>
                </QuoteProvider>
            </SettingsProvider>
        </AuthProvider>
    );
}

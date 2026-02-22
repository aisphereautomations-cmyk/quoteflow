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

                            {/* Main Content Area */}
                            <div className={styles.scrollableContent}>
                                {/* Quote Section */}
                                <section className={styles.quoteSection}>
                                    <QuoteForm />
                                </section>

                                {/* PDF Preview Section */}
                                <section className={styles.previewSection}>
                                    <PDFPreview />
                                </section>

                                {/* Client Information */}
                                <section className={styles.clientSection}>
                                    <ClientInfo />
                                </section>

                                {/* Actions Section */}
                                <section className={styles.actionsSection}>
                                    <ActionButtons />
                                </section>
                            </div>
                            <SettingsDrawer />
                        </main>
                    </ClientProvider>
                </QuoteProvider>
            </SettingsProvider>
        </AuthProvider>
    );
}

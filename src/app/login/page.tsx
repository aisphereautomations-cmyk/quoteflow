'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { getTranslator, type Locale } from '@/locales';
import styles from './page.module.css';

export default function LoginPage() {
    const router = useRouter();
    const supabase = createClient();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [mode, setMode] = useState<'login' | 'forgot'>('login');

    // Read language from localStorage (set by settings), default to 'en'
    const [locale, setLocale] = useState<Locale>('en');
    useEffect(() => {
        try {
            const stored = localStorage.getItem('quoteflow_language');
            if (stored) setLocale(stored as Locale);
        } catch { /* ignore */ }
    }, []);

    const t = getTranslator(locale);

    const handleLogin = async (e: FormEvent) => {
        e.preventDefault();
        setErrorMessage('');
        setSuccessMessage('');

        // Basic validation
        if (!email || !password) {
            setErrorMessage(t('login.fillAllFields'));
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setErrorMessage(t('login.validEmail'));
            return;
        }

        setIsLoading(true);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                // Handle specific Supabase auth errors
                if (error.message.includes('Invalid login credentials')) {
                    setErrorMessage(t('login.incorrectCredentials'));
                } else if (error.message.includes('Email not confirmed')) {
                    setErrorMessage(t('login.confirmEmail'));
                } else {
                    setErrorMessage(error.message);
                }
                return;
            }

            // Success — middleware will handle redirect, but let's push explicitly
            router.push('/main');
            router.refresh();
        } catch {
            setErrorMessage(t('login.unexpectedError'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubscribe = async () => {
        setErrorMessage('');
        setSuccessMessage('');

        // Validate fields are filled
        if (!email || !password) {
            setErrorMessage(t('login.fillAllFields'));
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setErrorMessage(t('login.validEmail'));
            return;
        }

        if (password.length < 6) {
            setErrorMessage(t('login.passwordMinLength'));
            return;
        }

        setIsLoading(true);

        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) {
                if (error.message.includes('already registered')) {
                    setErrorMessage(t('login.alreadyRegistered'));
                } else {
                    setErrorMessage(error.message);
                }
                return;
            }

            // Show success message
            setSuccessMessage(t('login.accountCreated'));
        } catch {
            setErrorMessage(t('login.unexpectedError'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotPassword = async (e: FormEvent) => {
        e.preventDefault();
        setErrorMessage('');
        setSuccessMessage('');

        if (!email) {
            setErrorMessage(t('login.fillEmail'));
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setErrorMessage(t('login.validEmail'));
            return;
        }

        setIsLoading(true);

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
            });

            if (error) {
                setErrorMessage(error.message);
                return;
            }

            setSuccessMessage(t('login.resetEmailSent'));
        } catch {
            setErrorMessage(t('login.unexpectedError'));
        } finally {
            setIsLoading(false);
        }
    };

    const switchToForgot = () => {
        setMode('forgot');
        setErrorMessage('');
        setSuccessMessage('');
    };

    const switchToLogin = () => {
        setMode('login');
        setErrorMessage('');
        setSuccessMessage('');
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <h1 className={styles.title}>{t('login.title')}</h1>
                    <h2 className={styles.subtitle}>
                        {mode === 'login' ? t('login.subtitle') : t('login.forgotSubtitle')}
                    </h2>
                </div>

                {mode === 'login' ? (
                    <form onSubmit={handleLogin} className={styles.form}>
                        <div className={styles.inputGroup}>
                            <label htmlFor="email" className={styles.label}>
                                {t('login.emailLabel')}
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={styles.input}
                                placeholder=""
                                disabled={isLoading}
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label htmlFor="password" className={styles.label}>
                                {t('login.passwordLabel')}
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={styles.input}
                                placeholder=""
                                disabled={isLoading}
                            />
                            <button
                                type="button"
                                className={styles.forgotLink}
                                onClick={switchToForgot}
                            >
                                {t('login.forgotPassword')}
                            </button>
                        </div>

                        {errorMessage && (
                            <div className={styles.errorMessage}>{errorMessage}</div>
                        )}

                        {successMessage && (
                            <div className={styles.successMessage}>{successMessage}</div>
                        )}

                        <button type="submit" className={styles.loginButton} disabled={isLoading}>
                            {isLoading ? t('login.loading') : t('login.loginButton')}
                        </button>

                        <button
                            type="button"
                            onClick={handleSubscribe}
                            className={styles.subscribeButton}
                            disabled={isLoading}
                        >
                            {isLoading ? t('login.loading') : t('login.subscribeButton')}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleForgotPassword} className={styles.form}>
                        <div className={styles.inputGroup}>
                            <label htmlFor="email" className={styles.label}>
                                {t('login.emailLabel')}
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={styles.input}
                                placeholder=""
                                disabled={isLoading}
                            />
                        </div>

                        {errorMessage && (
                            <div className={styles.errorMessage}>{errorMessage}</div>
                        )}

                        {successMessage && (
                            <div className={styles.successMessage}>{successMessage}</div>
                        )}

                        <button type="submit" className={styles.loginButton} disabled={isLoading}>
                            {isLoading ? t('login.loading') : t('login.sendResetLink')}
                        </button>

                        <button
                            type="button"
                            onClick={switchToLogin}
                            className={styles.forgotLink}
                            style={{ marginTop: '4px', textAlign: 'center', width: '100%' }}
                        >
                            {t('login.backToLogin')}
                        </button>
                    </form>
                )}

                <footer className={styles.footer}>
                    {t('login.footer')}
                    <a href="/privacy" className={styles.privacyLink}>{t('login.privacyPolicy')}</a>
                </footer>
            </div>
        </div>
    );
}

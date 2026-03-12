'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { getTranslator, type Locale } from '@/locales';
import styles from './page.module.css';

export default function ResetPasswordPage() {
    const router = useRouter();
    const supabase = createClient();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Read language from localStorage (set by settings), default to 'en'
    const [locale, setLocale] = useState<Locale>('en');
    useEffect(() => {
        try {
            const stored = localStorage.getItem('quoteflow_language');
            if (stored) setLocale(stored as Locale);
        } catch { /* ignore */ }
    }, []);

    const t = getTranslator(locale);

    const handleResetPassword = async (e: FormEvent) => {
        e.preventDefault();
        setErrorMessage('');
        setSuccessMessage('');

        if (!newPassword || !confirmPassword) {
            setErrorMessage(t('login.fillAllFields'));
            return;
        }

        if (newPassword.length < 6) {
            setErrorMessage(t('login.passwordMinLength'));
            return;
        }

        if (newPassword !== confirmPassword) {
            setErrorMessage(t('login.passwordsDoNotMatch'));
            return;
        }

        setIsLoading(true);

        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (error) {
                setErrorMessage(error.message);
                return;
            }

            setSuccessMessage(t('login.passwordUpdated'));

            // Redirect to main after a short delay
            setTimeout(() => {
                router.push('/main');
                router.refresh();
            }, 2000);
        } catch {
            setErrorMessage(t('login.unexpectedError'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <h1 className={styles.title}>{t('login.title')}</h1>
                    <h2 className={styles.subtitle}>{t('login.resetSubtitle')}</h2>
                </div>

                <form onSubmit={handleResetPassword} className={styles.form}>
                    <div className={styles.inputGroup}>
                        <label htmlFor="newPassword" className={styles.label}>
                            {t('login.newPasswordLabel')}
                        </label>
                        <input
                            id="newPassword"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className={styles.input}
                            placeholder=""
                            disabled={isLoading}
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label htmlFor="confirmPassword" className={styles.label}>
                            {t('login.confirmPasswordLabel')}
                        </label>
                        <input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
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
                        {isLoading ? t('login.loading') : t('login.updatePassword')}
                    </button>
                </form>

                <footer className={styles.footer}>
                    {t('login.footer')}
                </footer>
            </div>
        </div>
    );
}

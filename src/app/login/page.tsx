'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import styles from './page.module.css';

export default function LoginPage() {
    const router = useRouter();
    const supabase = createClient();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: FormEvent) => {
        e.preventDefault();
        setErrorMessage('');
        setSuccessMessage('');

        // Basic validation
        if (!email || !password) {
            setErrorMessage('Please fill in all fields');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setErrorMessage('Please enter a valid email');
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
                    setErrorMessage('Incorrect email or password');
                } else if (error.message.includes('Email not confirmed')) {
                    setErrorMessage('Please confirm your email before logging in');
                } else {
                    setErrorMessage(error.message);
                }
                return;
            }

            // Success — middleware will handle redirect, but let's push explicitly
            router.push('/main');
            router.refresh();
        } catch {
            setErrorMessage('An unexpected error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubscribe = async () => {
        setErrorMessage('');
        setSuccessMessage('');

        // Validate fields are filled
        if (!email || !password) {
            setErrorMessage('Please fill in all fields');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setErrorMessage('Please enter a valid email');
            return;
        }

        if (password.length < 6) {
            setErrorMessage('Password must be at least 6 characters');
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
                    setErrorMessage('This email is already registered. Please login instead.');
                } else {
                    setErrorMessage(error.message);
                }
                return;
            }

            // Show success message
            setSuccessMessage('Account created! Check your email to confirm, then login.');
        } catch {
            setErrorMessage('An unexpected error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Quote Flow</h1>
                    <h2 className={styles.subtitle}>Let´s Quote together !</h2>
                </div>

                <form onSubmit={handleLogin} className={styles.form}>
                    <div className={styles.inputGroup}>
                        <label htmlFor="email" className={styles.label}>
                            Email:
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
                            Password:
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
                    </div>

                    {errorMessage && (
                        <div className={styles.errorMessage}>{errorMessage}</div>
                    )}

                    {successMessage && (
                        <div className={styles.successMessage}>{successMessage}</div>
                    )}

                    <button type="submit" className={styles.loginButton} disabled={isLoading}>
                        {isLoading ? 'Loading...' : 'Login'}
                    </button>

                    <button
                        type="button"
                        onClick={handleSubscribe}
                        className={styles.subscribeButton}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Loading...' : 'Subscribe'}
                    </button>
                </form>

                <footer className={styles.footer}>
                    Powered by AI Sphere Automations
                </footer>
            </div>
        </div>
    );
}

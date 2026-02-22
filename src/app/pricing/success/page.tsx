'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './success.module.css';

export default function PaymentSuccessPage() {
    const router = useRouter();

    useEffect(() => {
        // Auto redirect after 5 seconds
        const timer = setTimeout(() => router.push('/main'), 5000);
        return () => clearTimeout(timer);
    }, [router]);

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.checkmark}>✓</div>
                <h1 className={styles.title}>Welcome to Quote Flow!</h1>
                <p className={styles.subtitle}>
                    Your subscription is now active. Start creating professional quotes right away.
                </p>
                <button
                    className={styles.startBtn}
                    onClick={() => router.push('/main')}
                >
                    Start Quoting →
                </button>
                <p className={styles.autoRedirect}>
                    Redirecting automatically in 5 seconds...
                </p>
            </div>
        </div>
    );
}

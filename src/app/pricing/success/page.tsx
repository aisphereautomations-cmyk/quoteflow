'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import styles from './success.module.css';

export default function PaymentSuccessPage() {
    const router = useRouter();
    const supabase = createClient();
    const [status, setStatus] = useState<'verifying' | 'ready' | 'timeout'>('verifying');

    const checkSubscription = useCallback(async (): Promise<boolean> => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return false;

            const { data } = await supabase
                .from('subscriptions')
                .select('status, trial_ends_at')
                .eq('user_id', user.id)
                .in('status', ['active', 'trial'])
                .maybeSingle();

            if (data) {
                const isActive =
                    data.status === 'active' ||
                    (data.status === 'trial' && data.trial_ends_at
                        ? new Date(data.trial_ends_at) > new Date()
                        : false);
                return isActive;
            }
            return false;
        } catch {
            return false;
        }
    }, [supabase]);

    useEffect(() => {
        let cancelled = false;
        let attempts = 0;
        const maxAttempts = 30; // 30 attempts × 2s = 60s max wait

        const poll = async () => {
            while (!cancelled && attempts < maxAttempts) {
                const active = await checkSubscription();
                if (active) {
                    if (!cancelled) {
                        setStatus('ready');
                        // Give user a moment to see the success message
                        setTimeout(() => {
                            if (!cancelled) router.push('/main');
                        }, 3000);
                    }
                    return;
                }
                attempts++;
                // Wait 2 seconds before next check
                await new Promise(r => setTimeout(r, 2000));
            }
            if (!cancelled) setStatus('timeout');
        };

        poll();
        return () => { cancelled = true; };
    }, [checkSubscription, router]);

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                {status === 'verifying' && (
                    <>
                        <div className={styles.spinner} />
                        <h1 className={styles.title}>Payment Received!</h1>
                        <p className={styles.subtitle}>
                            Activating your subscription, please wait a moment...
                        </p>
                    </>
                )}

                {status === 'ready' && (
                    <>
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
                            Redirecting automatically in 3 seconds...
                        </p>
                    </>
                )}

                {status === 'timeout' && (
                    <>
                        <div className={styles.checkmark}>✓</div>
                        <h1 className={styles.title}>Payment Confirmed!</h1>
                        <p className={styles.subtitle}>
                            Your payment was successful. Your subscription may take a moment to activate. 
                            Please try entering the app — if it redirects you back, wait a minute and try again.
                        </p>
                        <button
                            className={styles.startBtn}
                            onClick={() => router.push('/main')}
                        >
                            Enter App →
                        </button>
                        <button
                            className={styles.retryBtn}
                            onClick={() => {
                                setStatus('verifying');
                                window.location.reload();
                            }}
                        >
                            Check Again
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

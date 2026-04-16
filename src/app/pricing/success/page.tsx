'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import styles from './success.module.css';

function PaymentSuccessContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<'verifying' | 'ready' | 'error'>('verifying');
    const [errorMsg, setErrorMsg] = useState('');
    const hasStarted = useRef(false);

    const verifyPayment = useCallback(async () => {
        // Prevent double execution from React strict mode
        if (hasStarted.current) return;
        hasStarted.current = true;

        const intentId = searchParams.get('id');

        if (!intentId) {
            // No intent ID — might be a free trial or direct activation
            // Try going to /main directly
            router.push('/main');
            return;
        }

        try {
            const res = await fetch('/api/checkout/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ intentId }),
            });

            const data = await res.json();

            if (data.success) {
                setStatus('ready');
                // Auto redirect after showing success
                setTimeout(() => router.push('/main'), 3000);
            } else if (data.alreadyActive) {
                // Already has a subscription, just go to main
                setStatus('ready');
                setTimeout(() => router.push('/main'), 1500);
            } else {
                setStatus('error');
                setErrorMsg(data.error || 'Could not verify payment');
            }
        } catch (err) {
            console.error('Payment verification error:', err);
            setStatus('error');
            setErrorMsg('Network error. Please check your connection and try again.');
        }
    }, [searchParams, router]);

    useEffect(() => {
        verifyPayment();
    }, [verifyPayment]);

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

                {status === 'error' && (
                    <>
                        <div className={styles.errorIcon}>⚠</div>
                        <h1 className={styles.title}>Activation Issue</h1>
                        <p className={styles.subtitle}>
                            Your payment was received, but we had trouble activating your account.
                            {errorMsg && <><br /><br /><strong>Details:</strong> {errorMsg}</>}
                        </p>
                        <button
                            className={styles.startBtn}
                            onClick={() => {
                                hasStarted.current = false;
                                setStatus('verifying');
                                verifyPayment();
                            }}
                        >
                            Try Again
                        </button>
                        <p className={styles.supportText}>
                            If this persists, contact support and we'll fix it immediately.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}

export default function PaymentSuccessPage() {
    return (
        <Suspense fallback={
            <div className={styles.container}>
                <div className={styles.card}>
                    <div className={styles.spinner} />
                    <h1 className={styles.title}>Loading...</h1>
                </div>
            </div>
        }>
            <PaymentSuccessContent />
        </Suspense>
    );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PLANS, getYearlySavings, type BillingCycle, type PlanId } from '@/lib/plans';
import styles from './pricing.module.css';

export default function PricingPage() {
    const router = useRouter();
    const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
    const [promoCode, setPromoCode] = useState('');
    const [promoResult, setPromoResult] = useState<{
        valid: boolean;
        type?: string;
        value?: number;
        error?: string;
    } | null>(null);
    const [validatingPromo, setValidatingPromo] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    const validatePromo = async (planId: PlanId) => {
        if (!promoCode.trim()) return;
        setValidatingPromo(true);
        try {
            const res = await fetch('/api/promo/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: promoCode.trim(), plan: planId }),
            });
            const data = await res.json();
            setPromoResult(data);
        } catch {
            setPromoResult({ valid: false, error: 'Failed to validate code' });
        } finally {
            setValidatingPromo(false);
        }
    };

    const getDiscountedPrice = (price: number): number | null => {
        if (!promoResult?.valid) return null;
        if (promoResult.type === 'percentage_discount') {
            return price * (1 - (promoResult.value || 0) / 100);
        }
        if (promoResult.type === 'fixed_discount') {
            return Math.max(0, price - (promoResult.value || 0));
        }
        return null;
    };

    const handleSubscribe = async (planId: PlanId) => {
        setSelectedPlan(planId);
        setIsCheckingOut(true);

        // If promo code entered, validate it first
        if (promoCode.trim() && !promoResult) {
            await validatePromo(planId);
        }

        try {
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan: planId,
                    billingCycle,
                    promoCode: promoCode.trim() || undefined,
                }),
            });
            const data = await res.json();

            if (data.intentId && data.clientSecret) {
                // Airwallex payment — use SDK redirect
                const { redirectToCheckout, loadAirwallex } = await import('airwallex-payment-elements');
                await loadAirwallex({ env: 'prod' });
                await redirectToCheckout({
                    env: 'prod',
                    mode: 'payment',
                    intent_id: data.intentId,
                    client_secret: data.clientSecret,
                    currency: data.currency,
                    successUrl: `${window.location.origin}/pricing/success`,
                    failUrl: `${window.location.origin}/pricing?error=payment_failed`,
                    country_code: 'PT',
                });
            } else if (data.success) {
                // Free trial or dev mode — subscription activated directly
                router.push('/pricing/success');
            } else {
                alert(data.error || 'Failed to create checkout');
            }
        } catch (err) {
            console.error('Checkout error:', err);
            alert('Something went wrong. Please try again.');
        } finally {
            setIsCheckingOut(false);
            setSelectedPlan(null);
        }
    };

    const formatFeatureValue = (value: number | string): string => {
        if (value === Infinity) return 'Unlimited';
        if (typeof value === 'number') return value.toLocaleString();
        return value;
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Choose Your Plan</h1>
                <p className={styles.subtitle}>
                    Start creating professional quotes with AI-powered assistance
                </p>
            </div>

            {/* Billing Toggle */}
            <div className={styles.billingToggle}>
                <button
                    className={`${styles.toggleBtn} ${billingCycle === 'monthly' ? styles.toggleActive : ''}`}
                    onClick={() => setBillingCycle('monthly')}
                >
                    Monthly
                </button>
                <button
                    className={`${styles.toggleBtn} ${billingCycle === 'yearly' ? styles.toggleActive : ''}`}
                    onClick={() => setBillingCycle('yearly')}
                >
                    Yearly
                    <span className={styles.saveBadge}>Save ~33%</span>
                </button>
            </div>

            {/* Plan Cards */}
            <div className={styles.plansGrid}>
                {PLANS.map((plan) => {
                    const price = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
                    const discountedPrice = getDiscountedPrice(price);
                    const savings = getYearlySavings(plan);

                    return (
                        <div
                            key={plan.id}
                            className={`${styles.planCard} ${plan.highlight ? styles.planHighlight : ''}`}
                        >
                            {plan.highlight && (
                                <div className={styles.popularBadge}>Most Popular</div>
                            )}

                            <h2 className={styles.planName}>{plan.name}</h2>

                            <div className={styles.priceArea}>
                                {discountedPrice !== null ? (
                                    <>
                                        <span className={styles.originalPrice}>
                                            €{price.toFixed(2)}
                                        </span>
                                        <span className={styles.price}>
                                            €{discountedPrice.toFixed(2)}
                                        </span>
                                    </>
                                ) : (
                                    <span className={styles.price}>€{price.toFixed(2)}</span>
                                )}
                                <span className={styles.pricePeriod}>
                                    {billingCycle === 'yearly' ? '/year' : '/month'}
                                </span>
                            </div>

                            {billingCycle === 'yearly' && (
                                <p className={styles.yearlySaving}>
                                    Save {savings}% vs monthly
                                </p>
                            )}

                            <ul className={styles.featuresList}>
                                <li>
                                    <span className={styles.featureCheck}>✓</span>
                                    {formatFeatureValue(plan.features.aiTokensPerMonth)} AI tokens/month
                                </li>
                                <li>
                                    <span className={styles.featureCheck}>✓</span>
                                    {plan.features.aiModelTier}
                                </li>
                                <li>
                                    <span className={styles.featureCheck}>✓</span>
                                    {formatFeatureValue(plan.features.savedQuotes)} saved quotes
                                </li>
                                <li>
                                    <span className={styles.featureCheck}>✓</span>
                                    {plan.features.storageGB} GB storage
                                </li>
                                <li>
                                    <span className={styles.featureCheck}>✓</span>
                                    {formatFeatureValue(plan.features.quoteDownloads)} downloads/month
                                </li>
                                <li>
                                    <span className={styles.featureCheck}>✓</span>
                                    {plan.features.supportLabel}
                                </li>
                            </ul>

                            <button
                                className={`${styles.subscribeBtn} ${plan.highlight ? styles.subscribeBtnHighlight : ''}`}
                                onClick={() => handleSubscribe(plan.id)}
                                disabled={isCheckingOut}
                            >
                                {isCheckingOut && selectedPlan === plan.id
                                    ? 'Processing...'
                                    : `Get ${plan.name}`}
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Promo Code */}
            <div className={styles.promoSection}>
                <p className={styles.promoLabel}>Have a promo code?</p>
                <div className={styles.promoInputRow}>
                    <input
                        type="text"
                        placeholder="Enter code"
                        className={styles.promoInput}
                        value={promoCode}
                        onChange={(e) => {
                            setPromoCode(e.target.value.toUpperCase());
                            setPromoResult(null);
                        }}
                    />
                    <button
                        className={styles.promoApplyBtn}
                        onClick={() => validatePromo('starter')}
                        disabled={!promoCode.trim() || validatingPromo}
                    >
                        {validatingPromo ? '...' : 'Apply'}
                    </button>
                </div>
                {promoResult && (
                    <p className={promoResult.valid ? styles.promoSuccess : styles.promoError}>
                        {promoResult.valid
                            ? promoResult.type === 'free_days'
                                ? `✓ ${promoResult.value} days free trial activated!`
                                : promoResult.type === 'percentage_discount'
                                    ? `✓ ${promoResult.value}% discount applied!`
                                    : `✓ €${promoResult.value} discount applied!`
                            : promoResult.error}
                    </p>
                )}
            </div>

            <p className={styles.vatNote}>All prices include VAT</p>
        </div>
    );
}

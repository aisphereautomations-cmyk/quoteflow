export type PlanId = 'starter' | 'pro' | 'enterprise';
export type BillingCycle = 'monthly' | 'yearly';

export interface PlanConfig {
    id: PlanId;
    name: string;
    monthlyPrice: number;
    yearlyPrice: number;
    currency: string;
    features: {
        aiTokensPerMonth: number;
        savedQuotes: number;
        storageGB: number;
        quoteDownloads: number | 'unlimited';
        support: string;
    };
    highlight?: boolean; // For "Most Popular" badge
}

export const PLANS: PlanConfig[] = [
    {
        id: 'starter',
        name: 'Starter',
        monthlyPrice: 14.99,
        yearlyPrice: 120,
        currency: '€',
        features: {
            aiTokensPerMonth: 800_000,
            savedQuotes: 15,
            storageGB: 1,
            quoteDownloads: 1_000,
            support: 'Basic email support',
        },
    },
    {
        id: 'pro',
        name: 'Pro',
        monthlyPrice: 28.99,
        yearlyPrice: 232,
        currency: '€',
        highlight: true,
        features: {
            aiTokensPerMonth: 1_600_000,
            savedQuotes: 50,
            storageGB: 5,
            quoteDownloads: 5_000,
            support: 'Priority support',
        },
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        monthlyPrice: 52.99,
        yearlyPrice: 424,
        currency: '€',
        features: {
            aiTokensPerMonth: 3_200_000,
            savedQuotes: 200,
            storageGB: 20,
            quoteDownloads: Infinity,
            support: 'Dedicated support',
        },
    },
];

export function getPlan(id: PlanId): PlanConfig {
    return PLANS.find((p) => p.id === id)!;
}

export function getPrice(planId: PlanId, cycle: BillingCycle): number {
    const plan = getPlan(planId);
    return cycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
}

export function formatPrice(amount: number, currency: string = '€'): string {
    return `${currency}${amount.toFixed(2)}`;
}

export function getYearlySavings(plan: PlanConfig): number {
    return Math.round(((plan.monthlyPrice * 12 - plan.yearlyPrice) / (plan.monthlyPrice * 12)) * 100);
}

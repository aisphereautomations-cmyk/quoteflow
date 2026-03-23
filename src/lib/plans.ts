export type PlanId = 'starter' | 'pro' | 'enterprise';
export type BillingCycle = 'monthly' | 'yearly';

export interface SupportChannels {
    email: string;
    whatsapp?: string;
    phone?: string;
}

export interface MediaLimits {
    photoUploadsPerMonth: number;
    docUploadsPerMonth: number;
    voiceMinutesPerMonth: number;
    maxNotes: number;
}

export interface PlanConfig {
    id: PlanId;
    name: string;
    monthlyPrice: number;
    yearlyPrice: number;
    currency: string;
    features: {
        aiTokensPerMonth: number;
        aiModelTier: string;
        savedQuotes: number;
        storageGB: number;
        quoteDownloads: number | 'unlimited';
        mediaLimits: MediaLimits;
        support: SupportChannels;
        supportLabel: string;
    };
    highlight?: boolean;
}

const SUPPORT_EMAIL = 'aisphereautomations@gmail.com';
const SUPPORT_WHATSAPP = '+351920636021';
const SUPPORT_PHONE = '+351920636021';

export const PLANS: PlanConfig[] = [
    {
        id: 'starter',
        name: 'Starter',
        monthlyPrice: 14.99,
        yearlyPrice: 120,
        currency: '€',
        features: {
            aiTokensPerMonth: 800_000,
            aiModelTier: 'GPT-4o (limited) + GPT-4o-mini',
            savedQuotes: 15,
            storageGB: 1,
            quoteDownloads: 1_000,
            mediaLimits: { photoUploadsPerMonth: 15, docUploadsPerMonth: 5, voiceMinutesPerMonth: 60, maxNotes: 25 },
            support: { email: SUPPORT_EMAIL },
            supportLabel: 'Email support',
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
            aiModelTier: 'GPT-4o (unlimited)',
            savedQuotes: 50,
            storageGB: 5,
            quoteDownloads: 5_000,
            mediaLimits: { photoUploadsPerMonth: 200, docUploadsPerMonth: 80, voiceMinutesPerMonth: 120, maxNotes: 100 },
            support: { email: SUPPORT_EMAIL, whatsapp: SUPPORT_WHATSAPP },
            supportLabel: 'Email + WhatsApp support',
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
            aiModelTier: 'GPT-4o (unlimited, extended)',
            savedQuotes: 200,
            storageGB: 20,
            quoteDownloads: Infinity,
            mediaLimits: { photoUploadsPerMonth: 500, docUploadsPerMonth: 200, voiceMinutesPerMonth: 240, maxNotes: 500 },
            support: { email: SUPPORT_EMAIL, whatsapp: SUPPORT_WHATSAPP, phone: SUPPORT_PHONE },
            supportLabel: 'Email + WhatsApp + Phone support',
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

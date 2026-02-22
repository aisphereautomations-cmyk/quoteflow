'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { useAuth } from '@/app/main/context/AuthContext';
import type { PlanId, BillingCycle } from '@/lib/plans';

export interface Subscription {
    id: string;
    plan: PlanId;
    billingCycle: BillingCycle;
    status: 'active' | 'cancelled' | 'expired' | 'trial' | 'past_due';
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    promoCodeUsed: string | null;
}

interface SubscriptionContextType {
    subscription: Subscription | null;
    isActive: boolean;
    isLoading: boolean;
    refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
    const supabase = createClient();
    const { user } = useAuth();
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const refreshSubscription = useCallback(async () => {
        if (!user) {
            setSubscription(null);
            setIsLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', user.id)
                .in('status', ['active', 'trial'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                setSubscription({
                    id: data.id,
                    plan: data.plan,
                    billingCycle: data.billing_cycle,
                    status: data.status,
                    trialEndsAt: data.trial_ends_at,
                    currentPeriodEnd: data.current_period_end,
                    promoCodeUsed: data.promo_code_used,
                });
            } else {
                setSubscription(null);
            }
        } catch (err) {
            console.error('Error loading subscription:', err);
            setSubscription(null);
        } finally {
            setIsLoading(false);
        }
    }, [user, supabase]);

    useEffect(() => {
        refreshSubscription();
    }, [refreshSubscription]);

    const isActive = !!subscription && (
        subscription.status === 'active' ||
        (subscription.status === 'trial' && subscription.trialEndsAt
            ? new Date(subscription.trialEndsAt) > new Date()
            : false)
    );

    return (
        <SubscriptionContext.Provider value={{ subscription, isActive, isLoading, refreshSubscription }}>
            {children}
        </SubscriptionContext.Provider>
    );
}

export function useSubscription() {
    const context = useContext(SubscriptionContext);
    if (!context) {
        throw new Error('useSubscription must be used within a SubscriptionProvider');
    }
    return context;
}

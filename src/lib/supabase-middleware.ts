import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Updates the Supabase session in middleware.
 * This ensures the auth token is refreshed on every request.
 */
export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Refresh session — important for keeping the user logged in
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;

    // Protected routes: redirect to login if not authenticated
    if (!user && (pathname.startsWith('/main') || pathname.startsWith('/pricing') || pathname.startsWith('/admin'))) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    // Auth callback and reset-password routes: allow through (they handle their own auth)
    if (pathname.startsWith('/auth/')) {
        return supabaseResponse;
    }

    // If logged in and on login page or root, redirect to /main
    // The paywall below will redirect to /pricing if no active subscription
    if (user && (pathname === '/login' || pathname === '/')) {
        const url = request.nextUrl.clone();
        url.pathname = '/main';
        return NextResponse.redirect(url);
    }

    // Allow success page through without subscription check
    // (user just paid, webhook may not have arrived yet)
    if (pathname.startsWith('/pricing/success')) {
        return supabaseResponse;
    }

    // Paywall: check subscription before allowing access to /main
    if (user && pathname.startsWith('/main')) {
        const { data: subscription } = await supabase
            .from('subscriptions')
            .select('status, trial_ends_at')
            .eq('user_id', user.id)
            .in('status', ['active', 'trial'])
            .maybeSingle();

        const isActive = !!subscription && (
            subscription.status === 'active' ||
            (subscription.status === 'trial' && subscription.trial_ends_at
                ? new Date(subscription.trial_ends_at) > new Date()
                : false)
        );

        if (!isActive) {
            const url = request.nextUrl.clone();
            url.pathname = '/pricing';
            return NextResponse.redirect(url);
        }
    }

    return supabaseResponse;
}

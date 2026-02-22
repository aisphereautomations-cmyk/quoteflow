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

    // Protected routes: redirect to login if not authenticated
    if (
        !user &&
        request.nextUrl.pathname.startsWith('/main')
    ) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    // If logged in and on login page, redirect to main
    if (
        user &&
        request.nextUrl.pathname === '/login'
    ) {
        const url = request.nextUrl.clone();
        url.pathname = '/main';
        return NextResponse.redirect(url);
    }

    return supabaseResponse;
}

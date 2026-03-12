import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Auth callback handler for Supabase.
 * Handles password reset links and email confirmation links.
 * Supabase sends the user here with a code in the URL, which we exchange for a session.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const type = searchParams.get('type');

    if (code) {
        const supabaseResponse = NextResponse.next({ request });

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
                        cookiesToSet.forEach(({ name, value, options }) =>
                            supabaseResponse.cookies.set(name, value, options)
                        );
                    },
                },
            }
        );

        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            // If this is a password recovery, redirect to reset password page
            if (type === 'recovery') {
                const url = request.nextUrl.clone();
                url.pathname = '/auth/reset-password';
                url.search = '';
                const redirectResponse = NextResponse.redirect(url);
                // Copy cookies from supabase response to redirect response
                supabaseResponse.cookies.getAll().forEach((cookie) => {
                    redirectResponse.cookies.set(cookie.name, cookie.value);
                });
                return redirectResponse;
            }

            // For other types (email confirmation), redirect to main
            const url = request.nextUrl.clone();
            url.pathname = '/main';
            url.search = '';
            const redirectResponse = NextResponse.redirect(url);
            supabaseResponse.cookies.getAll().forEach((cookie) => {
                redirectResponse.cookies.set(cookie.name, cookie.value);
            });
            return redirectResponse;
        }
    }

    // If no code or error, redirect to login
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
}

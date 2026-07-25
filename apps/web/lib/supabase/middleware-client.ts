import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

/** middleware.ts 専用: レスポンスにセッション更新後のCookieを反映する。 */
export function createSupabaseMiddlewareClient(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options ?? {});
          }
        },
      },
    },
  );

  return { supabase, response };
}

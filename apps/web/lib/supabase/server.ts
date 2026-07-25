import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * RSC / Server Action / Route Handler から使う Supabase クライアント。
 * セッションは HttpOnly Cookie に保存される（設計書 7 章:
 * 「IDトークンを JS から保持」する旧実装から、XSS 耐性のある方式に変更）。
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options ?? {});
            }
          } catch {
            // Server Component からの set は無視してよい（middleware がセッションを更新する）
          }
        },
      },
    },
  );
}

import { type NextRequest, NextResponse } from 'next/server';
import { createSupabaseMiddlewareClient } from './lib/supabase/middleware-client';

/**
 * `/admin/*` を Edge Middleware で一括ガードする（設計書 7 章）。
 *
 * 旧実装は各 Express エンドポイントに `requireAdmin` を個別に付け忘れる余地があったが、
 * ファイルシステムルーティング + このミドルウェアの組み合わせにより、
 * 「新しい管理画面ルートを追加したのにガードを忘れる」という事故が構造的に起きなくなる
 * （RLS がさらにその下の DB レベルで二重に防御する）。
 */
export async function proxy(request: NextRequest) {
  const { supabase, response } = createSupabaseMiddlewareClient(request);

  const isAdminRoute =
    request.nextUrl.pathname.startsWith('/admin') && request.nextUrl.pathname !== '/admin/login';
  const isAdminApiRoute = request.nextUrl.pathname.startsWith('/api/admin');

  if (isAdminRoute || isAdminApiRoute) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      if (isAdminApiRoute) {
        return NextResponse.json(
          { success: false, error: { code: 'UNAUTHENTICATED' } },
          { status: 401 },
        );
      }
      const loginUrl = new URL('/admin/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
    // admin_users への実在チェックは RSC 側（lib/auth.ts の requireAdminUser）と
    // RLS が担う。Edge はレイテンシ最優先で「ログイン済みか」だけを見る。
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};

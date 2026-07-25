import { adminUsers } from '@tfk/db';
import { eq } from 'drizzle-orm';
import { getAppDb } from './db';
import { createSupabaseServerClient } from './supabase/server';

/**
 * 現在のセッションが admin_users に登録された管理者かどうかを判定する。
 * 認可の実行位置は Edge Middleware（一括ガード）+ ここでの RSC 内二重チェック +
 * RLS（DB レベル）の三段構え（設計書 7 章 / 9 章「レートリミット」「セキュリティ」参照）。
 */
export async function requireAdminUser() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const db = getAppDb();
  const admin = await db.query.adminUsers.findFirst({
    where: eq(adminUsers.authUserId, data.user.id),
  });
  return admin ?? null;
}

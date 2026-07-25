import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let _sql: ReturnType<typeof postgres> | undefined;
let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;

/**
 * DATABASE_URL は Supabase の Connection string（Session/Transaction pooler、または
 * ローカル開発用の Postgres）を指す。apps/web からは常にこのモジュール経由でのみ DB に触る
 * （設計書 5.3: 「apps/web は Drizzle の型を通してのみ DB に触る」）。
 */
export function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL が設定されていません（.env.example を参照）');
    _sql = postgres(url, { max: 10 });
    _db = drizzle(_sql, { schema });
  }
  return _db;
}

export async function closeDb(): Promise<void> {
  await _sql?.end();
  _sql = undefined;
  _db = undefined;
}

export { schema };

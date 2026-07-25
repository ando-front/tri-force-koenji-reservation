import { getDb } from '@tfk/db';

// apps/web は Drizzle の型を通してのみ DB に触る（設計書 5.3）。
// getDb() は遅延初期化のシングルトンだが、モジュール評価時点（ビルド時の静的解析等）で
// DATABASE_URL 未設定のまま呼ばれることを避けるため、呼び出し側で明示的に呼ぶ関数として公開する。
export function getAppDb() {
  return getDb();
}

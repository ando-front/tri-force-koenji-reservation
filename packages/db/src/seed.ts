import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { facilities } from './schema';

// 旧 functions/src/scripts/seedFacilities.ts の内容をそのまま移植（施設マスタは変更なし）。
const SEED_FACILITIES = [
  {
    id: 'koenji-free-mat-area',
    name: 'トライフォース高円寺 フリーマット',
    capacity: 20,
    openHour: 10,
    closeHour: 22,
    slotDurationMinutes: 60,
    closedWeekdays: [] as number[],
    isActive: true,
  },
  {
    id: 'koenji-fitness-area',
    name: 'トライフォース高円寺 フィットネス',
    capacity: 10,
    openHour: 10,
    closeHour: 22,
    slotDurationMinutes: 60,
    closedWeekdays: [] as number[],
    isActive: true,
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL が設定されていません');
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);

  for (const f of SEED_FACILITIES) {
    await db.insert(facilities).values(f).onConflictDoUpdate({ target: facilities.id, set: f });
  }

  await sql.end();
  console.log(`seeded ${SEED_FACILITIES.length} facilities`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

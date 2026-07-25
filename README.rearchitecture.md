# tri-force-koenji-reservation（リアーキ版）

トライフォース高円寺 施設予約システムの再アーキテクチャ実装。

設計書: [`リアーキテクチャ設計書.md`](../リアーキテクチャ設計書_tri-force-koenji.md)（同梱の zip 内 `docs/` を参照）。
このリポジトリは、設計書の Phase 1・2・5 相当（モノレポ化・core 抽出・Next.js アプリ構築）を
実装し、ローカル Postgres 上で動作確認まで完了させたものです。

## 現状（実装・検証済み）

| 領域 | 状態 |
|---|---|
| `packages/core` — JST時刻処理・空き状況ロジック・定員判定・iCal生成 | ✅ 実装・単体テスト14件パス |
| `packages/db` — Drizzleスキーマ・マイグレーション・RLS・予約作成/キャンセル | ✅ 実装・実 Postgres への統合テスト5件パス（定員超過拒否・冪等性・10並列同時実行など） |
| `apps/web` — Next.js 16（会員予約フロー・管理画面・CSV/iCalエクスポート） | ✅ 実装・`next build` 成功・Playwright での実ブラウザ動作確認済み |
| CI（`.github/workflows/ci.yml`） | ✅ turbo run lint/typecheck/test/build を Postgres サービスコンテナ付きで実行する設定を用意 |
| Supabase 本番プロジェクト・Google OIDC・Vercel デプロイ | ⬜ 未実施（下記「残作業」を参照。実クレデンシャルが必要） |
| Firestore → Postgres の実データ移行・突合 | ⬜ 未実施（設計書 Phase 4。既存データが必要） |

## セットアップ

```bash
pnpm install
cp .env.example .env   # DATABASE_URL 等を編集

# ローカル Postgres（または Supabase）にマイグレーションを適用
pnpm db:migrate
pnpm db:seed           # 施設マスタ2件を投入

pnpm dev               # apps/web が http://localhost:3000 で起動
```

動作確認だけしたい場合、ローカルの Postgres 16 に対して上記を実行すれば
会員側の予約フロー（空き状況表示 → 予約 → 完了 → 照会・キャンセル）はすぐ動きます。
管理画面（`/admin/*`）は Supabase Auth（Google OIDC）が必要なため、
`.env` に実際の Supabase プロジェクトの URL・キーを設定するまでログインできません。

## モノレポ構成

```
apps/web/          Next.js 16（App Router）。(public) と (admin) をルートグループで分離
packages/core/      DBもフレームワークも知らない純関数（時刻・空き状況・定員判定・iCal）
packages/db/        Drizzle スキーマ・マイグレーション・クエリ（apps/web はここ経由のみでDBに触る）
.github/workflows/  CI（lint/typecheck/test/build、Postgresサービスコンテナ）
```

## 検証方法

```bash
# 全パッケージ: 型検査・単体テスト・本番ビルド
pnpm typecheck
DATABASE_URL=postgres://postgres:postgres@localhost:5432/tfk pnpm test
pnpm build

# packages/db だけ: 定員制御・冪等性・10並列同時実行の統合テスト
DATABASE_URL=postgres://postgres:postgres@localhost:5432/tfk pnpm --filter @tfk/db test
```

## 残作業（実クレデンシャルが必要なため、この環境では実施できないもの）

設計書 10 章の移行計画のうち、Phase 3後半〜7 は以下の理由でこの開発環境では完了できません。
ユーザー側で以下を実施してください。

1. **Supabase プロジェクトの作成**
   - Project Settings → Database から接続文字列を取得し `.env` の `DATABASE_URL` に設定
   - Authentication → Providers で Google OAuth を有効化（Client ID/Secret は Google Cloud Console で発行）
   - `pnpm db:migrate` を実行（`0001_rls.sql` が RLS ポリシーと `v_busy_slots` ビューを作成）
   - `admin_users` テーブルに、管理者にする Google アカウントの `auth_user_id` / `email` を INSERT
2. **Vercel へのデプロイ**
   - このリポジトリを Vercel に接続（Git 連携で PR ごとに Preview が自動生成される）
   - 環境変数（`.env.example` の全項目）を Vercel の Project Settings → Environment Variables に設定
   - `NEXT_PUBLIC_APP_URL` は Vercel の本番 URL に設定
3. **Firestore → Postgres のデータ移行**（設計書 Phase 3〜4）
   - 既存 Firebase プロジェクトの `firebase-admin` 認証情報を使い、`facilities` / `reservations` /
     `auditLogs` をエクスポートするスクリプトを別途作成し、`packages/db` のクエリ経由で投入する
   - 日次で件数・内容を突合するバッチを回し、差分ゼロを確認してから Phase 5〜6（読み取り切替）に進む
   - この環境には実際の Firebase プロジェクトへのアクセス権がないため、移行スクリプト自体は
     ひな型のみ（`packages/db/src/seed.ts` を参考に、Firestore Admin SDK で読み出す処理に置き換える）
4. **Phase 0 の即時修正**（新アーキとは独立、現行 Firebase コードベースへの適用）
   - 同梱の `phase0-firebase-fixes.patch`（元リポジトリ `ando-front/tri-force-koenji-reservation`
     の `main` ブランチ、コミット `c725d89` に適用可能）に B-1・B-2・B-3・B-6 の修正と
     回帰テスト3種を含めています。`git apply phase0-firebase-fixes.patch` で適用し、
     `cd functions && npm test` で確認できます（この環境で適用・テスト実行済み、61件パス）。

## 設計書との対応

- 6.2 定員制御 → `packages/db/src/schema.ts` の `slotOccupancy`（`within_capacity` CHECK制約）
- 6.3 冪等性 → `reservations` の `uniq_idempotency` UNIQUE制約、`bookReservation()` の
  `onConflictDoNothing`
- 6.4 RLS → `migrations/0001_rls.sql`
- 7 認証 → `middleware`（`proxy.ts`）+ `lib/auth.ts` + RLS の三段防御
- 8.2 時刻の扱い → `packages/core/src/time.ts` に一元化（B-3 の根治）
- 付録B → 各修正箇所のコード内コメントに B-1〜B-6 の参照を明記

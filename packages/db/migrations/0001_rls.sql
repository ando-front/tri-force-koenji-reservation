-- 認可（RLS）— 設計書 6.4。
-- drizzle-kit は RLS ポリシーの差分検出を正式サポートしていないため、
-- このファイルは schema.ts からの自動生成ではなく手書きし、レビュー対象として PR に含める。

-- `anon` / `authenticated` は Supabase が管理する Postgres ロールとして本番にはすでに
-- 存在するが、ローカル開発用の素の Postgres には存在しないため、開発環境でも同じ
-- マイグレーションが通るように無ければ作成する（本番では何もしない no-op）。
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end
$$;

-- 同様に `auth.uid()` も Supabase 本番では auth スキーマにすでに定義されているが、
-- ローカル Postgres には存在しない。テスト用に「常に NULL（未ログイン）」を返す
-- スタブを用意し、Supabase 実体がある場合は上書きしない。
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    create schema auth;
    create function auth.uid() returns uuid
      language sql stable
      as $fn$ select current_setting('request.jwt.claim.sub', true)::uuid $fn$;
  end if;
end
$$;

alter table reservations enable row level security;
alter table slot_occupancy enable row level security;
alter table reservation_events enable row level security;
alter table admin_users enable row level security;

-- 予約は本人（将来のログイン制導入時）または管理者のみ読める。
-- 現行スコープ（会員はログインしない）では auth.uid() が member と紐づかないため、
-- 実質「サービスロール（Server Action / Route Handler）経由のみ」がアクセスする。
-- ポリシーは将来の会員ログイン導入に備えて先行して用意しておく。
create policy admin_reads_all_reservations on reservations for select
  to authenticated
  using (exists (select 1 from admin_users where admin_users.auth_user_id = auth.uid()));

create policy admin_writes_reservations on reservations for all
  to authenticated
  using (exists (select 1 from admin_users where admin_users.auth_user_id = auth.uid()))
  with check (exists (select 1 from admin_users where admin_users.auth_user_id = auth.uid()));

create policy admin_reads_slot_occupancy on slot_occupancy for select
  to authenticated
  using (exists (select 1 from admin_users where admin_users.auth_user_id = auth.uid()));

create policy admin_reads_events on reservation_events for select
  to authenticated
  using (exists (select 1 from admin_users where admin_users.auth_user_id = auth.uid()));

create policy self_reads_admin_users on admin_users for select
  to authenticated
  using (auth_user_id = auth.uid());

-- 空き状況の公開ビュー。氏名・メール・備考など個人情報を含む列を一切公開しない
-- （設計書 6.4: 「氏名を隠す」という将来の運用判断は、このビュー定義 1 行の変更で済む）。
create view v_busy_slots
  with (security_invoker = true)
  as
  select facility_id, starts_at, participants_total, capacity_snapshot
    from slot_occupancy;

grant select on v_busy_slots to anon, authenticated;

import { Link } from 'react-router-dom';

const DAILY_CHECKS = [
  'ログイン後、予約一覧が表示されることを確認する',
  '本日から直近数日の予約に未対応の仮受付が残っていないか確認する',
  '必要に応じて施設・日付・ステータスで絞り込んで確認する',
  'CSVエクスポートで当日の一覧を控える場合は、対象条件を絞ってから出力する',
];

const RESERVATION_ACTIONS = [
  '仮受付の予約は「確定」で受付完了にする',
  '利用不可や利用者都合で取り消す場合は「キャンセル」を選び、理由があれば入力する',
  '「削除」は復元できないため、重複登録や誤登録に限定して使う',
  '詳細画面では表示名、連絡先、人数、備考、キャンセル理由を確認できる',
];

const FACILITY_ACTIONS = [
  '施設管理では施設名、定員、営業時間、枠時間、公開状態を更新できる',
  '単発の休館日は「メンテナンス日」に追加する',
  '毎週の休館日は「定休日」で設定する',
  '公開を停止した施設は一般予約画面に表示されなくなる',
];

const ADMIN_RULES = [
  '管理者権限は Google ログインだけでは付与されず、Firestore の admins/{uid} 登録が必要',
  '管理者追加・削除は必ずダブルチェックし、最低 2 名以上の管理者を維持する',
  '新しい管理者を追加したら、本人が /admin/login からログインできることまで確認する',
  '権限変更や誤操作対応の詳細は docs/運用手順書.md の運用手順に従う',
];

function ManualSection({
  title,
  summary,
  items,
}: {
  title: string;
  summary: string;
  items: string[];
}) {
  return (
    <section className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-600">{summary}</p>
      </div>
      <ol className="space-y-2 text-sm text-gray-700">
        {items.map((item, index) => (
          <li key={item} className="flex gap-3">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
              {index + 1}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function AdminOperationsManualPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link to="/admin" className="text-sm text-brand-600 hover:underline">
            ← 予約管理へ
          </Link>
          <h1 className="text-lg font-bold text-gray-900">管理者操作マニュアル</h1>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <section className="card space-y-3 border border-brand-100 bg-brand-50/40">
          <p className="text-sm font-semibold text-brand-700">運用の基本</p>
          <p className="text-sm leading-6 text-gray-700">
            管理画面では、予約一覧の確認、ステータス更新、CSV 出力、施設設定の更新を行います。
            予約を確定する前に日時と施設を確認し、削除は誤登録時のみ使ってください。
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link to="/admin" className="btn-primary">
              予約一覧を開く
            </Link>
            <Link to="/admin/facilities" className="btn-secondary">
              施設管理を開く
            </Link>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <ManualSection
            title="日次確認"
            summary="ログイン直後に確認する内容です。"
            items={DAILY_CHECKS}
          />
          <ManualSection
            title="予約操作"
            summary="予約一覧と詳細画面で行う操作です。"
            items={RESERVATION_ACTIONS}
          />
          <ManualSection
            title="施設設定"
            summary="営業設定やメンテナンス日の更新手順です。"
            items={FACILITY_ACTIONS}
          />
          <ManualSection
            title="権限運用"
            summary="管理者アカウントを安全に扱うための注意点です。"
            items={ADMIN_RULES}
          />
        </div>
      </div>
    </div>
  );
}
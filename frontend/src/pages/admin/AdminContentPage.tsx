import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { adminUpdateUsageGuideContent, fetchUsageGuideContent } from '@/lib/api';
import { DEFAULT_USAGE_GUIDE_CONTENT, UpdateUsageGuideContentSchema } from '@/types';

const MAX_LINES = 20;

/** 1行1項目で textarea から配列に変換する */
function linesFromText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function textFromLines(lines: string[]): string {
  return lines.join('\n');
}

export function AdminContentPage() {
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['content', 'usage-guide'],
    queryFn:  fetchUsageGuideContent,
  });

  const [stepsText, setStepsText] = useState('');
  const [notesText, setNotesText] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // 取得後に textarea を初期化（ロードの初回 or リフェッチ後）
  useEffect(() => {
    if (!data) return;
    setStepsText(textFromLines(
      data.reservationSteps.length ? data.reservationSteps : DEFAULT_USAGE_GUIDE_CONTENT.reservationSteps
    ));
    setNotesText(textFromLines(data.notes));
  }, [data]);

  const mutation = useMutation({
    mutationFn: adminUpdateUsageGuideContent,
    onSuccess: (saved) => {
      qc.setQueryData(['content', 'usage-guide'], saved);
      setValidationError(null);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const reservationSteps = linesFromText(stepsText);
    const notes            = linesFromText(notesText);

    const parsed = UpdateUsageGuideContentSchema.safeParse({ reservationSteps, notes });
    if (!parsed.success) {
      setValidationError(parsed.error.errors[0]?.message ?? '入力内容を確認してください');
      return;
    }

    setValidationError(null);
    mutation.mutate(parsed.data);
  }

  function handleResetToDefault() {
    setStepsText(textFromLines(DEFAULT_USAGE_GUIDE_CONTENT.reservationSteps));
    setNotesText(textFromLines(DEFAULT_USAGE_GUIDE_CONTENT.notes));
    setValidationError(null);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">サイト文言編集</h1>
            <Link to="/admin"            className="text-sm text-brand-600 hover:underline">予約管理</Link>
            <Link to="/admin/dashboard"  className="text-sm text-brand-600 hover:underline">ダッシュボード</Link>
            <Link to="/admin/audit-logs" className="text-sm text-brand-600 hover:underline">監査ログ</Link>
            <Link to="/guide" target="_blank" rel="noreferrer" className="text-sm text-brand-600 hover:underline">
              利用案内ページを見る ↗
            </Link>
          </div>
          <button onClick={() => signOut(auth)} className="btn-secondary text-xs">
            ログアウト
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6">
        {isLoading && <p className="text-sm text-gray-500">読み込み中…</p>}
        {isError   && <p className="text-sm text-red-600">取得に失敗しました</p>}

        {data && (
          <form onSubmit={handleSubmit} className="card space-y-6">
            <div>
              <h2 className="text-base font-semibold text-gray-900">利用案内ページ（/guide）</h2>
              <p className="mt-1 text-xs text-gray-500">
                1行1項目で入力してください。空行は自動的に除去されます。各項目は最大500文字、各リスト最大{MAX_LINES}件まで。保存と同時に公開ページへ反映されます。
              </p>
              {Boolean(data.updatedAt) && (
                <p className="mt-1 text-xs text-gray-400">
                  最終更新: {(() => {
                    const ts = data.updatedAt as { _seconds?: number; seconds?: number } | undefined;
                    const seconds = ts?._seconds ?? ts?.seconds;
                    return typeof seconds === 'number'
                      ? new Date(seconds * 1000).toLocaleString('ja-JP')
                      : '—';
                  })()}
                  {data.updatedBy ? `（${data.updatedBy.slice(0, 8)}）` : ''}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="steps" className="form-label">予約の流れ（1行1ステップ）<span className="text-red-500">*</span></label>
              <textarea
                id="steps"
                rows={6}
                value={stepsText}
                onChange={(e) => setStepsText(e.target.value)}
                className="form-input font-mono text-sm"
              />
            </div>

            <div>
              <label htmlFor="notes" className="form-label">留意事項（1行1項目・空でも可）</label>
              <textarea
                id="notes"
                rows={8}
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                className="form-input font-mono text-sm"
              />
            </div>

            {validationError && (
              <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{validationError}</p>
            )}
            {mutation.isError && (
              <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                保存に失敗しました: {(mutation.error as Error)?.message}
              </p>
            )}
            {mutation.isSuccess && !mutation.isPending && (
              <p className="rounded-md bg-green-50 p-3 text-sm text-green-700">保存しました</p>
            )}

            <div className="flex gap-3">
              <button type="submit" disabled={mutation.isPending} className="btn-primary">
                {mutation.isPending ? '保存中…' : '保存'}
              </button>
              <button type="button" onClick={handleResetToDefault} className="btn-secondary">
                既定値に戻す
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

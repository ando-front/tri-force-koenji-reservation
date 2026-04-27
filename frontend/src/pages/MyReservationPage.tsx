import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import {
  CancelReservationSchema,
  LookupReservationSchema,
  LookupReservationsByEmailSchema,
  type PublicReservationSummary,
  type PublicReservationView,
} from '@/types';
import {
  cancelReservationByMember,
  lookupReservation,
  lookupReservationsByEmail,
} from '@/lib/api';
import { formatReservationDisplayName } from '@/lib/reservationDisplay';

type LookupForm        = z.infer<typeof LookupReservationSchema>;
type LookupByEmailForm = z.infer<typeof LookupReservationsByEmailSchema>;

type Mode = 'code' | 'email';

const STATUS_LABEL: Record<string, string> = {
  pending:   '仮受付',
  confirmed: '確定',
  cancelled: 'キャンセル',
};
const STATUS_COLOR: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100  text-green-800',
  cancelled: 'bg-gray-100   text-gray-600',
};

function todayJst(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split('T')[0];
}

export function MyReservationPage() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>('code');
  const [reservation, setReservation] = useState<PublicReservationView | null>(null);
  const [credentials, setCredentials] = useState<{ reservationCode: string; email: string } | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  // メールで一覧モードで取得した予約サマリ一覧（reservationCode は含まない）
  const [emailMatches, setEmailMatches] = useState<PublicReservationSummary[] | null>(null);
  const [emailUsedForList, setEmailUsedForList] = useState<string>('');

  // ─── 予約番号で照会 ────────────────────────────────────────────────────────
  const codeForm = useForm<LookupForm>({
    resolver: zodResolver(LookupReservationSchema),
    defaultValues: {
      reservationCode: searchParams.get('code') ?? '',
      email:           '',
    },
  });

  const lookupMutation = useMutation({
    mutationFn: lookupReservation,
    onSuccess: (data, variables) => {
      setReservation(data);
      setCredentials({ reservationCode: variables.reservationCode, email: variables.email });
      setConfirmingCancel(false);
      setCancelReason('');
    },
  });

  const onCodeSubmit = codeForm.handleSubmit((data) => lookupMutation.mutate(data));

  // ─── メールで一覧 ─────────────────────────────────────────────────────────
  const emailForm = useForm<LookupByEmailForm>({
    resolver: zodResolver(LookupReservationsByEmailSchema),
    defaultValues: { email: '' },
  });

  const emailListMutation = useMutation({
    mutationFn: lookupReservationsByEmail,
    onSuccess: (data, variables) => {
      setEmailMatches(data);
      setEmailUsedForList(variables.email);
      setReservation(null);
    },
  });

  const onEmailSubmit = emailForm.handleSubmit((data) => emailListMutation.mutate(data));

  /**
   * 一覧で選んだ予約はサマリのみで reservationCode を持たないため、
   * 「予約番号で照会」タブにメールだけプリフィルした状態で誘導する。
   * これにより本人確認として予約番号入力が必須となり、メールだけでの
   * 詳細閲覧・キャンセルを防止する。
   */
  function jumpToCodeLookupFromList() {
    codeForm.setValue('email', emailUsedForList);
    codeForm.setValue('reservationCode', '');
    setMode('code');
    setReservation(null);
    setEmailMatches(null);
    // reservationCode 入力欄にフォーカス
    requestAnimationFrame(() => {
      const el = document.getElementById('reservationCode') as HTMLInputElement | null;
      el?.focus();
    });
  }

  // ─── キャンセル ──────────────────────────────────────────────────────────
  const cancelMutation = useMutation({
    mutationFn: cancelReservationByMember,
    onSuccess: (data) => {
      setReservation(data);
      setConfirmingCancel(false);
      // 一覧側のキャッシュも更新（キャンセル済みは一覧から消す）。
      // 関数型 setState で古いクロージャを参照しないようにする。
      // Summary には reservationCode が無いため、日付＋施設＋開始時刻で同定する。
      setEmailMatches((prev) =>
        prev
          ? prev.filter(
              (m) =>
                !(
                  m.date === data.date &&
                  m.startTime === data.startTime &&
                  m.facilityId === data.facilityId
                )
            )
          : prev,
      );
    },
  });

  function handleConfirmCancel() {
    if (!credentials) return;
    const validated = CancelReservationSchema.safeParse({
      ...credentials,
      cancelReason,
    });
    if (!validated.success) return;
    cancelMutation.mutate(validated.data);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setReservation(null);
    setEmailMatches(null);
    setEmailUsedForList('');
    setConfirmingCancel(false);
    setCancelReason('');
    lookupMutation.reset();
    emailListMutation.reset();
  }

  const isPast = reservation ? reservation.date < todayJst() : false;
  const canCancel = reservation && reservation.status !== 'cancelled' && !isPast;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-xl px-4">
        <header className="mb-6">
          <Link to="/" className="text-sm text-brand-600 hover:underline">
            ← 予約ページへ戻る
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">予約の確認・キャンセル</h1>
          <p className="mt-2 text-sm text-gray-600">
            予約番号で個別に確認するか、メールアドレスでアクティブな予約を一覧表示できます。
          </p>
        </header>

        {/* タブ切替 */}
        <div role="tablist" className="mb-3 flex rounded-md border border-gray-200 bg-white p-1 text-sm">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'code'}
            onClick={() => switchMode('code')}
            className={`flex-1 rounded px-3 py-2 transition ${
              mode === 'code' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            予約番号で照会
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'email'}
            onClick={() => switchMode('email')}
            className={`flex-1 rounded px-3 py-2 transition ${
              mode === 'email' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            メールで一覧
          </button>
        </div>

        {/* 予約番号で照会 */}
        {mode === 'code' && (
          <form onSubmit={onCodeSubmit} className="card space-y-5">
            <div>
              <label htmlFor="reservationCode" className="form-label">
                予約番号 <span className="text-red-500">*</span>
              </label>
              <input
                id="reservationCode"
                type="text"
                autoComplete="off"
                inputMode="text"
                maxLength={8}
                placeholder="例：A1B2C3D4"
                className="form-input font-mono uppercase tracking-widest"
                {...codeForm.register('reservationCode')}
              />
              {codeForm.formState.errors.reservationCode && (
                <p className="form-error">{codeForm.formState.errors.reservationCode.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="form-label">
                メールアドレス <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="例：taro@example.com"
                className="form-input"
                {...codeForm.register('email')}
              />
              {codeForm.formState.errors.email && (
                <p className="form-error">{codeForm.formState.errors.email.message}</p>
              )}
            </div>

            {lookupMutation.isError && (
              <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                {lookupMutation.error.message}
              </p>
            )}

            <button type="submit" disabled={lookupMutation.isPending} className="btn-primary w-full">
              {lookupMutation.isPending ? '照会中…' : '予約を照会する'}
            </button>
          </form>
        )}

        {/* メールで一覧 */}
        {mode === 'email' && (
          <form onSubmit={onEmailSubmit} className="card space-y-5">
            <div>
              <label htmlFor="emailListEmail" className="form-label">
                メールアドレス <span className="text-red-500">*</span>
              </label>
              <input
                id="emailListEmail"
                type="email"
                autoComplete="email"
                placeholder="例：taro@example.com"
                className="form-input"
                {...emailForm.register('email')}
              />
              {emailForm.formState.errors.email && (
                <p className="form-error">{emailForm.formState.errors.email.message}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                予約完了メールに記載のアドレスを入力してください。プライバシー保護のため、
                未来日のアクティブな予約のみが表示されます（過去・キャンセル済みは表示しません）。
              </p>
            </div>

            {emailListMutation.isError && (
              <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                {emailListMutation.error.message}
              </p>
            )}

            <button type="submit" disabled={emailListMutation.isPending} className="btn-primary w-full">
              {emailListMutation.isPending ? '検索中…' : 'この方の予約を一覧する'}
            </button>
          </form>
        )}

        {/* メール一覧結果 */}
        {mode === 'email' && emailMatches && !reservation && (
          <div className="card mt-6 space-y-4">
            {emailMatches.length === 0 ? (
              <p className="text-sm text-gray-500">
                該当する本日以降のアクティブな予約はありません。
              </p>
            ) : (
              <>
                <ul className="divide-y divide-gray-100">
                  {emailMatches.map((m, idx) => (
                    <li key={`${m.date}-${m.startTime}-${m.facilityId}-${idx}`} className="py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-gray-900">{m.facilityName}</p>
                          <p className="text-xs text-gray-500">
                            {m.date} {m.startTime} 〜 {m.endTime} ／ {m.participants}名
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                            STATUS_COLOR[m.status] ?? 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {STATUS_LABEL[m.status] ?? m.status}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="rounded-md border border-brand-100 bg-brand-50/40 p-3 text-xs text-brand-800">
                  個別の詳細表示・キャンセルには予約完了メール記載の予約番号が必要です。
                </div>
                <button
                  type="button"
                  onClick={jumpToCodeLookupFromList}
                  className="btn-primary w-full"
                >
                  予約番号を入力して詳細・キャンセルへ進む
                </button>
              </>
            )}
          </div>
        )}

        {/* 予約詳細 */}
        {reservation && (
          <div className="card mt-6 space-y-5">
            <div className="flex items-center gap-3">
              <span
                className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${
                  STATUS_COLOR[reservation.status] ?? 'bg-gray-100 text-gray-600'
                }`}
              >
                {STATUS_LABEL[reservation.status] ?? reservation.status}
              </span>
              <span className="font-mono text-xs text-gray-400">#{reservation.reservationCode}</span>
            </div>

            <dl className="divide-y divide-gray-100 text-sm">
              {[
                ['表示名', formatReservationDisplayName(reservation.memberName)],
                ['施設',   reservation.facilityName],
                ['日付',   reservation.date],
                ['時間',   `${reservation.startTime} 〜 ${reservation.endTime}`],
                ['人数',   `${reservation.participants}名`],
                ['利用目的', reservation.purpose],
                ['備考',   reservation.remarks || '—'],
                ['キャンセル理由', reservation.cancelReason ?? '—'],
              ].map(([label, value]) => (
                <div key={label as string} className="flex gap-4 py-3">
                  <dt className="w-28 shrink-0 text-gray-500">{label}</dt>
                  <dd className="break-all">{value}</dd>
                </div>
              ))}
            </dl>

            {reservation.status === 'cancelled' && (
              <p className="rounded-md bg-gray-100 p-3 text-sm text-gray-600">
                この予約はキャンセル済みです。
              </p>
            )}
            {reservation.status !== 'cancelled' && isPast && (
              <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                過去日のためオンラインでのキャンセルはできません。変更が必要な場合は運営までご連絡ください。
              </p>
            )}

            {canCancel && !confirmingCancel && (
              <button
                type="button"
                onClick={() => setConfirmingCancel(true)}
                className="btn-danger"
              >
                この予約をキャンセルする
              </button>
            )}

            {canCancel && confirmingCancel && (
              <div className="space-y-3 rounded-md border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-800">
                  本当にキャンセルしますか？この操作は取り消せません。
                </p>
                <div>
                  <label htmlFor="cancelReason" className="form-label">
                    キャンセル理由（任意・500文字以内）
                  </label>
                  <textarea
                    id="cancelReason"
                    rows={2}
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    maxLength={500}
                    className="form-input"
                    placeholder="例：予定変更のため"
                  />
                </div>
                {cancelMutation.isError && (
                  <p className="text-sm text-red-700">{cancelMutation.error.message}</p>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleConfirmCancel}
                    disabled={cancelMutation.isPending}
                    className="btn-danger"
                  >
                    {cancelMutation.isPending ? '処理中…' : 'キャンセルを確定する'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingCancel(false)}
                    disabled={cancelMutation.isPending}
                    className="btn-secondary"
                  >
                    戻る
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

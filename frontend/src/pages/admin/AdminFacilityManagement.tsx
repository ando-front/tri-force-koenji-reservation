import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { auth } from '@/lib/firebase';
import {
  adminCreateFacility,
  adminListFacilities,
  adminUpdateFacility,
} from '@/lib/api';
import type {
  Facility,
  CreateFacilityInput,
  UpdateFacilityInput,
  WeekdayHours,
} from '@/types';

const WEEKDAYS = [
  { value: 0, label: '日' },
  { value: 1, label: '月' },
  { value: 2, label: '火' },
  { value: 3, label: '水' },
  { value: 4, label: '木' },
  { value: 5, label: '金' },
  { value: 6, label: '土' },
] as const;

type FacilityFormState = CreateFacilityInput;

const defaultFormState = (): FacilityFormState => ({
  facilityId: '',
  name: '',
  capacity: 20,
  openHour: 10,
  closeHour: 22,
  slotDurationMinutes: 60,
  closedWeekdays: [],
  maintenanceDates: [],
  weekdayHours: [],
  isActive: true,
});

function toFormState(facility: Facility): FacilityFormState {
  return {
    facilityId: facility.facilityId,
    name: facility.name,
    capacity: facility.capacity,
    openHour: facility.openHour,
    closeHour: facility.closeHour,
    slotDurationMinutes: facility.slotDurationMinutes,
    closedWeekdays: facility.closedWeekdays,
    maintenanceDates: facility.maintenanceDates,
    weekdayHours: facility.weekdayHours ?? [],
    isActive: facility.isActive,
  };
}

/** dateFrom から dateTo までの日付文字列の配列を返す */
function dateRange(from: string, to: string): string[] {
  const result: string[] = [];
  const current = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  while (current <= end) {
    result.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return result;
}

export function AdminFacilityManagement() {
  const qc = useQueryClient();
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [form, setForm] = useState<FacilityFormState>(defaultFormState);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [maintenanceDateInput, setMaintenanceDateInput] = useState('');
  const [maintenanceDateFrom, setMaintenanceDateFrom] = useState('');
  const [maintenanceDateTo, setMaintenanceDateTo] = useState('');

  // 曜日別営業時間の一括設定用ステート
  const [bulkWeekdays, setBulkWeekdays] = useState<number[]>([]);
  const [bulkOpenHour, setBulkOpenHour] = useState(10);
  const [bulkCloseHour, setBulkCloseHour] = useState(22);
  const [bulkSlotDurationMinutes, setBulkSlotDurationMinutes] = useState<number | ''>('');

  const { data: facilities = [], isLoading, isError } = useQuery({
    queryKey: ['admin', 'facilities'],
    queryFn: adminListFacilities,
  });

  useEffect(() => {
    if (!selectedFacilityId) return;
    const facility = facilities.find((item) => item.facilityId === selectedFacilityId);
    if (facility) setForm(toFormState(facility));
  }, [facilities, selectedFacilityId]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateFacilityInput) => adminCreateFacility(payload),
    onSuccess: (facility) => {
      setErrorMessage(null);
      setSelectedFacilityId(facility.facilityId);
      qc.invalidateQueries({ queryKey: ['admin', 'facilities'] });
      qc.invalidateQueries({ queryKey: ['facilities'] });
    },
    onError: (error) => {
      setErrorMessage(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateFacilityInput }) =>
      adminUpdateFacility(id, payload),
    onSuccess: (facility) => {
      setErrorMessage(null);
      setSelectedFacilityId(facility.facilityId);
      qc.invalidateQueries({ queryKey: ['admin', 'facilities'] });
      qc.invalidateQueries({ queryKey: ['facilities'] });
    },
    onError: (error) => {
      setErrorMessage(error.message);
    },
  });

  const isEditing = Boolean(selectedFacilityId);
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  function resetForm() {
    setSelectedFacilityId(null);
    setForm(defaultFormState());
    setErrorMessage(null);
    setMaintenanceDateInput('');
    setMaintenanceDateFrom('');
    setMaintenanceDateTo('');
    setBulkWeekdays([]);
    setBulkOpenHour(10);
    setBulkCloseHour(22);
    setBulkSlotDurationMinutes('');
  }

  function toggleBulkWeekday(weekday: number) {
    setBulkWeekdays((current) =>
      current.includes(weekday)
        ? current.filter((w) => w !== weekday)
        : [...current, weekday].sort((a, b) => a - b),
    );
  }

  function applyBulkWeekdayHours() {
    if (bulkWeekdays.length === 0) return;
    setForm((current) => {
      const existing = current.weekdayHours ?? [];
      const updated = [...existing];
      for (const weekday of bulkWeekdays) {
        const entry: WeekdayHours = {
          weekday,
          openHour: bulkOpenHour,
          closeHour: bulkCloseHour,
          ...(bulkSlotDurationMinutes !== '' ? { slotDurationMinutes: bulkSlotDurationMinutes } : {}),
        };
        const idx = updated.findIndex((wh) => wh.weekday === weekday);
        if (idx === -1) {
          updated.push(entry);
        } else {
          updated[idx] = entry;
        }
      }
      return { ...current, weekdayHours: updated.sort((a, b) => a.weekday - b.weekday) };
    });
    setBulkWeekdays([]);
  }

  function updateField<K extends keyof FacilityFormState>(key: K, value: FacilityFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleClosedWeekday(weekday: number) {
    setForm((current) => {
      const exists = current.closedWeekdays.includes(weekday);
      return {
        ...current,
        closedWeekdays: exists
          ? current.closedWeekdays.filter((value) => value !== weekday)
          : [...current.closedWeekdays, weekday].sort((left, right) => left - right),
      };
    });
  }

  function addMaintenanceDate() {
    if (!maintenanceDateInput) return;
    setForm((current) => ({
      ...current,
      maintenanceDates: [...new Set([...current.maintenanceDates, maintenanceDateInput])].sort(),
    }));
    setMaintenanceDateInput('');
  }

  function addMaintenanceDateRange() {
    if (!maintenanceDateFrom || !maintenanceDateTo) return;
    if (maintenanceDateFrom > maintenanceDateTo) return;
    const dates = dateRange(maintenanceDateFrom, maintenanceDateTo);
    setForm((current) => ({
      ...current,
      maintenanceDates: [...new Set([...current.maintenanceDates, ...dates])].sort(),
    }));
    setMaintenanceDateFrom('');
    setMaintenanceDateTo('');
  }

  function removeMaintenanceDate(date: string) {
    setForm((current) => ({
      ...current,
      maintenanceDates: current.maintenanceDates.filter((value) => value !== date),
    }));
  }

  function updateWeekdayHours(weekday: number, field: keyof Omit<WeekdayHours, 'weekday'>, value: number | undefined) {
    setForm((current) => {
      const existing = current.weekdayHours ?? [];
      const idx = existing.findIndex((wh) => wh.weekday === weekday);
      if (idx === -1) {
        // 新規追加（施設デフォルトをベースに）
        return {
          ...current,
          weekdayHours: [
            ...existing,
            {
              weekday,
              openHour: field === 'openHour' ? (value ?? current.openHour) : current.openHour,
              closeHour: field === 'closeHour' ? (value ?? current.closeHour) : current.closeHour,
              slotDurationMinutes: field === 'slotDurationMinutes' ? value : undefined,
            },
          ].sort((a, b) => a.weekday - b.weekday),
        };
      }
      const updated = [...existing];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...current, weekdayHours: updated };
    });
  }

  function toggleWeekdayHours(weekday: number, enabled: boolean) {
    setForm((current) => {
      const existing = current.weekdayHours ?? [];
      if (!enabled) {
        return { ...current, weekdayHours: existing.filter((wh) => wh.weekday !== weekday) };
      }
      if (existing.some((wh) => wh.weekday === weekday)) return current;
      return {
        ...current,
        weekdayHours: [
          ...existing,
          { weekday, openHour: current.openHour, closeHour: current.closeHour },
        ].sort((a, b) => a.weekday - b.weekday),
      };
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (isEditing && selectedFacilityId) {
      const { facilityId: _, ...payload } = form;
      updateMutation.mutate({ id: selectedFacilityId, payload });
      return;
    }

    createMutation.mutate(form);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/admin" className="text-sm text-brand-600 hover:underline">
              ← 予約管理へ
            </Link>
            <Link to="/admin/manual" className="text-sm text-brand-600 hover:underline">
              操作マニュアル
            </Link>
            <h1 className="text-lg font-bold text-gray-900">施設管理</h1>
          </div>
          <button onClick={() => signOut(auth)} className="btn-secondary text-xs">
            ログアウト
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h2 className="font-semibold text-gray-900">施設一覧</h2>
            <button onClick={resetForm} className="btn-secondary text-sm">
              新規施設を追加
            </button>
          </div>

          {isLoading && <p className="p-4 text-sm text-gray-500">読み込み中…</p>}
          {isError && <p className="p-4 text-sm text-red-600">施設一覧の取得に失敗しました</p>}
          {!isLoading && facilities.length === 0 && (
            <p className="p-4 text-sm text-gray-500">施設はまだ登録されていません</p>
          )}

          {facilities.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['施設名', '施設ID', '営業時間', '定員', '状態'].map((header) => (
                      <th
                        key={header}
                        className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {facilities.map((facility) => {
                    const selected = facility.facilityId === selectedFacilityId;
                    return (
                      <tr
                        key={facility.facilityId}
                        className={`cursor-pointer hover:bg-gray-50 ${selected ? 'bg-brand-50/50' : ''}`}
                        onClick={() => {
                          setSelectedFacilityId(facility.facilityId);
                          setForm(toFormState(facility));
                          setErrorMessage(null);
                        }}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">{facility.name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{facility.facilityId}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {facility.openHour}:00 - {facility.closeHour}:00 / {facility.slotDurationMinutes}分
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{facility.capacity}名</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${facility.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                            {facility.isActive ? '公開中' : '停止中'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-900">
                {isEditing ? '施設を編集' : '施設を新規作成'}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                施設情報、営業時間、メンテナンス日、公開状態をここから管理します。
              </p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="form-label" htmlFor="facilityId">施設ID</label>
              <input
                id="facilityId"
                value={form.facilityId}
                onChange={(event) => updateField('facilityId', event.target.value)}
                className="form-input"
                disabled={isEditing}
                placeholder="koenji-main-dojo"
              />
            </div>

            <div>
              <label className="form-label" htmlFor="name">施設名</label>
              <input
                id="name"
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                className="form-input"
                placeholder="トライフォース高円寺 メイン道場"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="form-label" htmlFor="capacity">定員</label>
                <input
                  id="capacity"
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={(event) => updateField('capacity', Number(event.target.value))}
                  className="form-input"
                />
              </div>
              <div className="flex items-center gap-2 pt-8">
                <input
                  id="isActive"
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => updateField('isActive', event.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">公開する</label>
              </div>
            </div>

            {/* デフォルト営業時間 */}
            <div>
              <span className="form-label">デフォルト営業時間</span>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1" htmlFor="openHour">開始</label>
                  <input
                    id="openHour"
                    type="number"
                    min={0}
                    max={23}
                    value={form.openHour}
                    onChange={(event) => updateField('openHour', Number(event.target.value))}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1" htmlFor="closeHour">終了</label>
                  <input
                    id="closeHour"
                    type="number"
                    min={1}
                    max={24}
                    value={form.closeHour}
                    onChange={(event) => updateField('closeHour', Number(event.target.value))}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1" htmlFor="slotDurationMinutes">枠時間(分)</label>
                  <input
                    id="slotDurationMinutes"
                    type="number"
                    min={15}
                    step={15}
                    value={form.slotDurationMinutes}
                    onChange={(event) => updateField('slotDurationMinutes', Number(event.target.value))}
                    className="form-input"
                  />
                </div>
              </div>
            </div>

            {/* 曜日別営業時間 */}
            <div>
              <span className="form-label">曜日別営業時間（カスタム設定）</span>
              <p className="mb-2 text-xs text-gray-500">チェックを入れた曜日のみ個別の営業時間を設定できます。未設定の曜日はデフォルト営業時間を使用します。</p>

              {/* 一括設定パネル */}
              <div className="mb-3 rounded-md border border-brand-200 bg-brand-50/40 p-3">
                <p className="mb-2 text-xs font-medium text-brand-700">複数曜日に同じ設定を一括適用</p>
                <div className="mb-2 flex flex-wrap gap-3">
                  {WEEKDAYS.map((weekday) => (
                    <label key={weekday.value} className="flex items-center gap-1 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={bulkWeekdays.includes(weekday.value)}
                        onChange={() => toggleBulkWeekday(weekday.value)}
                        className="h-4 w-4"
                      />
                      <span>{weekday.label}</span>
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">開始</span>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={bulkOpenHour}
                      onChange={(e) => setBulkOpenHour(Number(e.target.value))}
                      className="form-input w-16 py-1 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">終了</span>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={bulkCloseHour}
                      onChange={(e) => setBulkCloseHour(Number(e.target.value))}
                      className="form-input w-16 py-1 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">枠(分)</span>
                    <input
                      type="number"
                      min={15}
                      step={15}
                      placeholder={String(form.slotDurationMinutes)}
                      value={bulkSlotDurationMinutes}
                      onChange={(e) =>
                        setBulkSlotDurationMinutes(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      className="form-input w-20 py-1 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={applyBulkWeekdayHours}
                    disabled={bulkWeekdays.length === 0}
                    className="btn-secondary whitespace-nowrap text-sm disabled:opacity-40"
                  >
                    選択曜日に一括適用
                  </button>
                </div>
              </div>

              <div className="space-y-2 rounded-md border border-gray-200 p-3">
                {WEEKDAYS.map((weekday) => {
                  const override = (form.weekdayHours ?? []).find((wh) => wh.weekday === weekday.value);
                  const isEnabled = Boolean(override);
                  return (
                    <div key={weekday.value} className="flex flex-wrap items-center gap-2">
                      <label className="flex w-12 items-center gap-1.5 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) => toggleWeekdayHours(weekday.value, e.target.checked)}
                          className="h-4 w-4"
                        />
                        <span>{weekday.label}</span>
                      </label>
                      {isEnabled && override && (
                        <>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">開始</span>
                            <input
                              type="number"
                              min={0}
                              max={23}
                              value={override.openHour}
                              onChange={(e) => updateWeekdayHours(weekday.value, 'openHour', Number(e.target.value))}
                              className="form-input w-16 py-1 text-sm"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">終了</span>
                            <input
                              type="number"
                              min={1}
                              max={24}
                              value={override.closeHour}
                              onChange={(e) => updateWeekdayHours(weekday.value, 'closeHour', Number(e.target.value))}
                              className="form-input w-16 py-1 text-sm"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">枠(分)</span>
                            <input
                              type="number"
                              min={15}
                              step={15}
                              placeholder={String(form.slotDurationMinutes)}
                              value={override.slotDurationMinutes ?? ''}
                              onChange={(e) =>
                                updateWeekdayHours(
                                  weekday.value,
                                  'slotDurationMinutes',
                                  e.target.value === '' ? undefined : Number(e.target.value),
                                )
                              }
                              className="form-input w-20 py-1 text-sm"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="form-label">定休日</span>
              <div className="mt-2 flex flex-wrap gap-3">
                {WEEKDAYS.map((weekday) => (
                  <label key={weekday.value} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.closedWeekdays.includes(weekday.value)}
                      onChange={() => toggleClosedWeekday(weekday.value)}
                      className="h-4 w-4"
                    />
                    <span>{weekday.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="form-label">メンテナンス日</label>

              {/* 1日単位で追加 */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  id="maintenanceDate"
                  type="date"
                  value={maintenanceDateInput}
                  onChange={(event) => setMaintenanceDateInput(event.target.value)}
                  className="form-input"
                />
                <button type="button" onClick={addMaintenanceDate} className="btn-secondary whitespace-nowrap">
                  1日追加
                </button>
              </div>

              {/* 期間で一括追加 */}
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="date"
                  value={maintenanceDateFrom}
                  onChange={(e) => setMaintenanceDateFrom(e.target.value)}
                  className="form-input"
                  placeholder="開始日"
                />
                <span className="text-sm text-gray-500">〜</span>
                <input
                  type="date"
                  value={maintenanceDateTo}
                  onChange={(e) => setMaintenanceDateTo(e.target.value)}
                  className="form-input"
                  placeholder="終了日"
                />
                <button
                  type="button"
                  onClick={addMaintenanceDateRange}
                  disabled={!maintenanceDateFrom || !maintenanceDateTo || maintenanceDateFrom > maintenanceDateTo}
                  className="btn-secondary whitespace-nowrap disabled:opacity-40"
                >
                  期間で一括追加
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {form.maintenanceDates.length === 0 && (
                  <span className="text-sm text-gray-500">登録されているメンテナンス日はありません</span>
                )}
                {form.maintenanceDates.map((date) => (
                  <button
                    key={date}
                    type="button"
                    onClick={() => removeMaintenanceDate(date)}
                    className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm text-amber-800"
                  >
                    {date} ×
                  </button>
                ))}
              </div>
            </div>

            {errorMessage && (
              <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <button type="submit" disabled={isSubmitting} className="btn-primary">
                {isSubmitting ? '保存中…' : isEditing ? '変更を保存' : '施設を作成'}
              </button>
              <button type="button" onClick={resetForm} className="btn-secondary">
                入力をリセット
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
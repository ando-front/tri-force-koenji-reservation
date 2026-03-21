import { auth } from './firebase';
import type {
  Facility,
  AvailabilitySlot,
  CreateReservationResponse,
  ListReservationsQuery,
  Reservation,
} from '@shared/types';

const BASE_URL = (import.meta.env.VITE_FUNCTIONS_BASE_URL as string) ?? '';

// ---- helpers ---------------------------------------------------------------

async function request<T>(
  path: string,
  options: RequestInit = {},
  withAuth = false,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (withAuth) {
    const user = auth.currentUser;
    if (!user) throw new Error('未認証です');
    const token = await user.getIdToken();
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    const err  = new Error(body?.message ?? 'API エラー') as Error & { status: number };
    err.status = res.status;
    throw err;
  }

  return res.json() as Promise<T>;
}

// ---- 公開 API ---------------------------------------------------------------

/** 施設一覧を取得 */
export function fetchFacilities(): Promise<Facility[]> {
  return request<Facility[]>('/facilities');
}

/** 空き状況を取得 */
export function fetchAvailability(
  facilityId: string,
  date: string,
): Promise<{ slots: AvailabilitySlot[] }> {
  const params = new URLSearchParams({ facilityId, date });
  return request<{ slots: AvailabilitySlot[] }>(`/availability?${params}`);
}

/** 予約を作成（一般ユーザー） */
export function createReservation(
  payload: unknown,
): Promise<CreateReservationResponse> {
  return request<CreateReservationResponse>('/reservations', {
    method:  'POST',
    body:    JSON.stringify(payload),
  });
}

// ---- 管理者 API --------------------------------------------------------------

/** 予約一覧を取得（管理者） */
export function adminListReservations(
  query: ListReservationsQuery,
): Promise<{ reservations: Reservation[]; nextCursor: string | null }> {
  const params = new URLSearchParams(
    Object.fromEntries(
      Object.entries(query).filter(([, v]) => v !== undefined) as [string, string][],
    ),
  );
  return request<{ reservations: Reservation[]; nextCursor: string | null }>(
    `/reservations/admin?${params}`,
    {},
    true,
  );
}

/** 予約詳細を取得（管理者） */
export function adminGetReservation(id: string): Promise<Reservation> {
  return request<{ reservation: Reservation }>(`/reservations/admin/${id}`, {}, true).then(
    (res) => res.reservation,
  );
}

/** 予約ステータスを更新（管理者） */
export function adminUpdateReservationStatus(
  id: string,
  payload: { status: string; cancelReason?: string },
): Promise<Reservation> {
  return request<{ reservation: Reservation }>(
    `/reservations/admin/${id}/status`,
    { method: 'PATCH', body: JSON.stringify(payload) },
    true,
  ).then((res) => res.reservation);
}

/** 予約を削除（管理者） */
export function adminDeleteReservation(id: string): Promise<void> {
  return request<void>(`/reservations/admin/${id}`, { method: 'DELETE' }, true);
}

/** CSVエクスポートURLを返す（管理者IDトークン付き） */
export async function adminExportCsvUrl(
  query: Pick<ListReservationsQuery, 'facilityId' | 'dateFrom' | 'dateTo' | 'status'>,
): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('未認証です');
  const token  = await user.getIdToken();
  const params = new URLSearchParams({
    ...(Object.fromEntries(
      Object.entries(query).filter(([, v]) => v !== undefined) as [string, string][],
    )),
    token, // サーバー側でクエリトークンも受け付ける場合向け
  });
  return `${BASE_URL}/reservations/admin/export?${params}`;
}

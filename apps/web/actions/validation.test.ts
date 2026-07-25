import { CreateReservationInputSchema, todayJst } from '@tfk/core';
import { describe, expect, it } from 'vitest';

// Server Action の入口バリデーション（設計書 8.1 の Server Action 化）が
// 旧 API の CreateReservationSchema と同じ制約（90日以内・過去日不可等）を
// 維持していることを確認する。
describe('CreateReservationInputSchema（apps/web の入口）', () => {
  const nearFuture = new Date(`${todayJst()}T00:00:00Z`);
  nearFuture.setUTCDate(nearFuture.getUTCDate() + 7);

  const base = {
    memberName: 'テスト',
    email: 'test@example.com',
    facilityId: 'koenji-fitness-area',
    date: nearFuture.toISOString().split('T')[0],
    startTime: '10:00',
    participants: 3,
    purpose: 'テスト',
    remarks: '',
    idempotencyKey: '00000000-0000-0000-0000-000000000000',
  };

  it('有効な入力を受け付ける', () => {
    expect(CreateReservationInputSchema.safeParse(base).success).toBe(true);
  });

  it('参加人数0名は拒否する', () => {
    expect(CreateReservationInputSchema.safeParse({ ...base, participants: 0 }).success).toBe(
      false,
    );
  });

  it('idempotencyKey が UUID でなければ拒否する（B-5 の前提）', () => {
    expect(
      CreateReservationInputSchema.safeParse({ ...base, idempotencyKey: 'not-a-uuid' }).success,
    ).toBe(false);
  });

  it('過去日付は拒否する', () => {
    expect(CreateReservationInputSchema.safeParse({ ...base, date: '2000-01-01' }).success).toBe(
      false,
    );
  });

  it('90日より先の日付は拒否する', () => {
    const tooFar = new Date(`${todayJst()}T00:00:00Z`);
    tooFar.setUTCDate(tooFar.getUTCDate() + 91);
    const date = tooFar.toISOString().split('T')[0];
    expect(CreateReservationInputSchema.safeParse({ ...base, date }).success).toBe(false);
  });
});

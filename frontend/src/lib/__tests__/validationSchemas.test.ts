import { describe, it, expect } from 'vitest';
import { FacilityFormSchema, UpdateStatusSchema } from '@shared/types';

describe('FacilityFormSchema', () => {
  const validFacility = {
    facilityId: 'test-dojo',
    name: 'テスト道場',
    capacity: 20,
    openHour: 10,
    closeHour: 22,
    slotDurationMinutes: 60,
    closedWeekdays: [0],
    maintenanceDates: [],
    isActive: true,
  };

  it('正しい入力はバリデーションを通過する', () => {
    const result = FacilityFormSchema.safeParse(validFacility);
    expect(result.success).toBe(true);
  });

  it('施設IDが空の場合はエラー', () => {
    const result = FacilityFormSchema.safeParse({ ...validFacility, facilityId: '' });
    expect(result.success).toBe(false);
  });

  it('施設IDに大文字や記号が含まれるとエラー', () => {
    const result = FacilityFormSchema.safeParse({ ...validFacility, facilityId: 'Test_Dojo!' });
    expect(result.success).toBe(false);
  });

  it('終了時刻が開始時刻以前だとエラー', () => {
    const result = FacilityFormSchema.safeParse({ ...validFacility, openHour: 18, closeHour: 10 });
    expect(result.success).toBe(false);
  });

  it('定員が0以下だとエラー', () => {
    const result = FacilityFormSchema.safeParse({ ...validFacility, capacity: 0 });
    expect(result.success).toBe(false);
  });

  it('枠時間が15分未満だとエラー', () => {
    const result = FacilityFormSchema.safeParse({ ...validFacility, slotDurationMinutes: 10 });
    expect(result.success).toBe(false);
  });

  it('メンテナンス日のフォーマットが不正だとエラー', () => {
    const result = FacilityFormSchema.safeParse({
      ...validFacility,
      maintenanceDates: ['2026/01/01'],
    });
    expect(result.success).toBe(false);
  });
});

describe('UpdateStatusSchema', () => {
  it('confirmed を受け付ける', () => {
    const result = UpdateStatusSchema.safeParse({ status: 'confirmed' });
    expect(result.success).toBe(true);
  });

  it('cancelled + 理由を受け付ける', () => {
    const result = UpdateStatusSchema.safeParse({
      status: 'cancelled',
      cancelReason: 'テスト理由',
    });
    expect(result.success).toBe(true);
  });

  it('pending は受け付けない（管理者は pending に戻せない）', () => {
    const result = UpdateStatusSchema.safeParse({ status: 'pending' });
    expect(result.success).toBe(false);
  });

  it('不正なステータスはエラー', () => {
    const result = UpdateStatusSchema.safeParse({ status: 'invalid' });
    expect(result.success).toBe(false);
  });
});

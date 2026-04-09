import { describe, it, expect } from 'vitest';
import { formatReservationDisplayName } from '../reservationDisplay';

describe('formatReservationDisplayName', () => {
  it('名前が入力されていればそのまま返す', () => {
    expect(formatReservationDisplayName('山田太郎')).toBe('山田太郎');
  });

  it('空文字の場合は「未入力」を返す', () => {
    expect(formatReservationDisplayName('')).toBe('未入力');
  });

  it('スペースのみの場合は「未入力」を返す', () => {
    expect(formatReservationDisplayName('   ')).toBe('未入力');
  });

  it('前後のスペースをトリムする', () => {
    expect(formatReservationDisplayName('  田中  ')).toBe('田中');
  });
});

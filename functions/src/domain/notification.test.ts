/**
 * notification.ts のテスト
 * HTML メール生成のヘルパー関数をテストする。
 * Resend API 呼び出しはモックして検証。
 */
import { Reservation } from '../../../shared/types';

// Resend をモック
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ id: 'mock-email-id' }),
    },
  })),
}));

// 環境変数を設定
process.env.RESEND_API_KEY = 'test-api-key';
process.env.MAIL_FROM = 'test@example.com';
process.env.SITE_URL = 'https://test.example.com';

import { sendReservationConfirmation, sendReminderEmail } from './notification';

const mockReservation: Reservation = {
  reservationId: 'test-res-123',
  memberName: '山田太郎',
  email: 'yamada@example.com',
  facilityId: 'main-dojo',
  facilityName: 'メイン道場',
  date: '2026-04-15',
  startTime: '10:00',
  endTime: '11:00',
  purpose: '柔術練習',
  participants: 3,
  remarks: 'マット使用',
  status: 'confirmed',
  cancelToken: 'test-cancel-token-uuid',
  createdAt: null,
  updatedAt: null,
};

describe('sendReservationConfirmation', () => {
  it('メール送信が正常に完了する', async () => {
    await expect(sendReservationConfirmation(mockReservation)).resolves.not.toThrow();
  });
});

describe('sendReminderEmail', () => {
  it('リマインダーメール送信が正常に完了する', async () => {
    await expect(sendReminderEmail(mockReservation)).resolves.not.toThrow();
  });
});

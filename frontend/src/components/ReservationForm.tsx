import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { CreateReservationSchema } from '@/types';
import { createReservation } from '@/lib/api';
import type { CreateReservationResponse } from '@/types';

type FormData = z.infer<typeof CreateReservationSchema>;

interface Props {
  facilityId: string;
  date:       string;
  startTime:  string;
}

export function ReservationForm({ facilityId, date, startTime }: Props) {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver:      zodResolver(CreateReservationSchema),
    defaultValues: { facilityId, date, startTime },
  });

  const mutation = useMutation<CreateReservationResponse, Error, FormData>({
    mutationFn: createReservation,
    onSuccess:  (data) => {
      navigate('/complete', { state: { response: data } });
    },
  });

  const onSubmit = handleSubmit((data) => mutation.mutate(data));

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* 隠しフィールド */}
      <input type="hidden" {...register('facilityId')} value={facilityId} />
      <input type="hidden" {...register('date')}       value={date} />
      <input type="hidden" {...register('startTime')}  value={startTime} />

      {/* 氏名 */}
      <div>
        <label htmlFor="memberName" className="form-label">
          ニックネーム（任意）
        </label>
        <input
          id="memberName"
          type="text"
          autoComplete="name"
          placeholder="例：ケンジ、Aさん"
          className="form-input"
          {...register('memberName')}
        />
        <p className="mt-1 text-xs text-gray-500">
          未入力の場合は予約状況に「会員1」「会員2」などで表示されます。
        </p>
        {errors.memberName && (
          <p className="form-error">{errors.memberName.message}</p>
        )}
      </div>

      {/* メールアドレス */}
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
          {...register('email')}
        />
        {errors.email && (
          <p className="form-error">{errors.email.message}</p>
        )}
      </div>

      {/* 人数 */}
      <div>
        <label htmlFor="participants" className="form-label">
          参加人数 <span className="text-red-500">*</span>
        </label>
        <input
          id="participants"
          type="number"
          min={1}
          max={100}
          className="form-input"
          {...register('participants', { valueAsNumber: true })}
        />
        {errors.participants && (
          <p className="form-error">{errors.participants.message}</p>
        )}
      </div>

      {/* 利用目的 */}
      <div>
        <label htmlFor="purpose" className="form-label">
          利用目的 <span className="text-red-500">*</span>
        </label>
        <textarea
          id="purpose"
          rows={2}
          className="form-input"
          placeholder="例：自主練習"
          {...register('purpose')}
        />
        {errors.purpose && (
          <p className="form-error">{errors.purpose.message}</p>
        )}
      </div>

      {/* 備考 */}
      <div>
        <label htmlFor="remarks" className="form-label">
          備考（任意）
        </label>
        <textarea
          id="remarks"
          rows={3}
          className="form-input"
          placeholder="ご要望等があればご記入ください"
          {...register('remarks')}
        />
        {errors.remarks && (
          <p className="form-error">{errors.remarks.message}</p>
        )}
      </div>

      {/* API エラー */}
      {mutation.isError && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {mutation.error.message}
        </p>
      )}

      {/* 送信 */}
      <button
        type="submit"
        disabled={mutation.isPending}
        className="btn-primary w-full"
      >
        {mutation.isPending ? '送信中…' : '予約を確定する'}
      </button>
    </form>
  );
}

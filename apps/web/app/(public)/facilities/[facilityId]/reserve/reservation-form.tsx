'use client';

import { useActionState } from 'react';
import {
  type CreateReservationActionState,
  createReservationAction,
} from '@/actions/create-reservation';

const initialState: CreateReservationActionState = {};

export function ReservationForm({
  facilityId,
  date,
  startTime,
  idempotencyKey,
}: {
  facilityId: string;
  date: string;
  startTime: string;
  idempotencyKey: string;
}) {
  const [state, formAction, pending] = useActionState(createReservationAction, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="facilityId" value={facilityId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      {state.error && <p className="error">{state.error}</p>}

      <div className="field">
        <label htmlFor="date">利用日</label>
        <input id="date" name="date" type="date" defaultValue={date} required />
        {state.fields?.date && <span className="error">{state.fields.date}</span>}
      </div>

      <div className="field">
        <label htmlFor="startTime">開始時刻</label>
        <input id="startTime" name="startTime" type="time" defaultValue={startTime} required />
        {state.fields?.startTime && <span className="error">{state.fields.startTime}</span>}
      </div>

      <div className="field">
        <label htmlFor="memberName">お名前</label>
        <input id="memberName" name="memberName" type="text" maxLength={50} />
      </div>

      <div className="field">
        <label htmlFor="email">メールアドレス</label>
        <input id="email" name="email" type="email" required />
        {state.fields?.email && <span className="error">{state.fields.email}</span>}
      </div>

      <div className="field">
        <label htmlFor="participants">参加人数</label>
        <input
          id="participants"
          name="participants"
          type="number"
          min={1}
          max={100}
          defaultValue={1}
          required
        />
        {state.fields?.participants && <span className="error">{state.fields.participants}</span>}
      </div>

      <div className="field">
        <label htmlFor="purpose">利用目的</label>
        <input id="purpose" name="purpose" type="text" maxLength={200} required />
        {state.fields?.purpose && <span className="error">{state.fields.purpose}</span>}
      </div>

      <div className="field">
        <label htmlFor="remarks">備考</label>
        <textarea id="remarks" name="remarks" maxLength={500} rows={3} />
      </div>

      <button className="btn" type="submit" disabled={pending}>
        {pending ? '送信中…' : '予約する'}
      </button>
    </form>
  );
}

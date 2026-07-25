'use client';

import { useActionState } from 'react';
import { cancelReservationAction } from '@/actions/cancel-reservation';

export function CancelButton({ reservationId, email }: { reservationId: string; email: string }) {
  const [state, formAction, pending] = useActionState(cancelReservationAction, {});

  return (
    <form action={formAction} style={{ display: 'inline' }}>
      <input type="hidden" name="reservationId" value={reservationId} />
      <input type="hidden" name="email" value={email} />
      <button
        type="submit"
        disabled={pending}
        style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        {pending ? '処理中…' : 'キャンセル'}
      </button>
      {state.error && <span className="error"> {state.error}</span>}
    </form>
  );
}

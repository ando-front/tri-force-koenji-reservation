'use client';

import { useActionState } from 'react';
import { createFacilityAction } from '@/actions/manage-facility';

export function CreateFacilityForm() {
  const [state, formAction, pending] = useActionState(createFacilityAction, {});

  return (
    <form action={formAction}>
      {state.error && <p className="error">{state.error}</p>}
      <div className="field">
        <label htmlFor="id">ID（半角英数・ハイフン）</label>
        <input id="id" name="id" required pattern="[a-z0-9-]+" />
      </div>
      <div className="field">
        <label htmlFor="name">名称</label>
        <input id="name" name="name" required maxLength={100} />
      </div>
      <div className="field">
        <label htmlFor="capacity">定員</label>
        <input id="capacity" name="capacity" type="number" min={1} max={500} required />
      </div>
      <div className="field">
        <label htmlFor="openHour">開始時刻（時）</label>
        <input
          id="openHour"
          name="openHour"
          type="number"
          min={0}
          max={23}
          defaultValue={10}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="closeHour">終了時刻（時）</label>
        <input
          id="closeHour"
          name="closeHour"
          type="number"
          min={1}
          max={24}
          defaultValue={22}
          required
        />
      </div>
      <button className="btn" type="submit" disabled={pending}>
        {pending ? '送信中…' : '追加する'}
      </button>
    </form>
  );
}

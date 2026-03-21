import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FacilitySelector }  from '@/components/FacilitySelector';
import { AvailabilityGrid }  from '@/components/AvailabilityGrid';
import { ReservationForm }   from '@/components/ReservationForm';

/** 今日の日付を YYYY-MM-DD で返す */
function today(): string {
  return new Date().toISOString().split('T')[0];
}

/** 日付の min/max 値（今日〜90日後） */
function maxDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  return d.toISOString().split('T')[0];
}

type Step = 'select' | 'form';

export function ReservationPage() {
  const [facilityId,  setFacilityId]  = useState('');
  const [date,        setDate]        = useState(today());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [step,        setStep]        = useState<Step>('select');

  const canProceed = Boolean(facilityId) && Boolean(date) && Boolean(selectedSlot);

  function handleProceed() {
    if (canProceed) setStep('form');
  }

  function handleBack() {
    setStep('select');
    setSelectedSlot(null);
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-2xl px-4">
        <header className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">施設予約</h1>
          <p className="mt-1 text-sm text-gray-500">
            トライフォース高円寺
          </p>
          <div className="mt-3 flex justify-center gap-4 text-sm">
            <Link to="/guide" className="text-brand-600 hover:underline">
              利用案内・留意事項
            </Link>
          </div>
        </header>

        {step === 'select' && (
          <div className="card space-y-8">
            <div className="rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-800">
              予約状況にはニックネーム、未入力時は「会員1」形式の表示名が表示されます。利用前に
              <Link to="/guide" className="ml-1 font-medium underline underline-offset-2">
                利用案内と留意事項
              </Link>
              を確認してください。
            </div>

            {/* 施設選択 */}
            <FacilitySelector value={facilityId} onChange={setFacilityId} />

            {/* 日付選択 */}
            <div>
              <label htmlFor="date" className="form-label">
                日付を選択
              </label>
              <input
                id="date"
                type="date"
                value={date}
                min={today()}
                max={maxDate()}
                onChange={(e) => {
                  setDate(e.target.value);
                  setSelectedSlot(null);
                }}
                className="form-input"
              />
            </div>

            {/* 空き状況グリッド */}
            <AvailabilityGrid
              facilityId={facilityId}
              date={date}
              selectedSlot={selectedSlot}
              onSelectSlot={setSelectedSlot}
            />

            {/* 次へ */}
            <button
              type="button"
              disabled={!canProceed}
              onClick={handleProceed}
              className="btn-primary w-full"
            >
              予約情報を入力する
            </button>
          </div>
        )}

        {step === 'form' && facilityId && date && selectedSlot && (
          <div className="card space-y-6">
            {/* 選択内容サマリ */}
            <div className="rounded-md bg-brand-50 p-4 text-sm text-brand-700">
              <p>
                <span className="font-medium">日時：</span>
                {date} {selectedSlot}〜
              </p>
            </div>

            <ReservationForm
              facilityId={facilityId}
              date={date}
              startTime={selectedSlot}
            />

            <button
              type="button"
              onClick={handleBack}
              className="btn-secondary w-full"
            >
              ← 日時を選び直す
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

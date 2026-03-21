import { useQuery } from '@tanstack/react-query';
import { fetchAvailability } from '@/lib/api';
import type { AvailabilitySlot } from '@/types';

interface Props {
  facilityId:      string;
  date:            string;
  selectedSlot:    string | null;
  onSelectSlot:    (startTime: string) => void;
}

export function AvailabilityGrid({ facilityId, date, selectedSlot, onSelectSlot }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['availability', facilityId, date],
    queryFn:  () => fetchAvailability(facilityId, date),
    enabled:  Boolean(facilityId) && Boolean(date),
  });

  if (!facilityId || !date) {
    return <p className="text-sm text-gray-400">施設と日付を選択してください</p>;
  }

  if (isLoading) {
    return <p className="text-sm text-gray-500">空き状況を確認しています…</p>;
  }

  if (isError) {
    return <p className="text-sm text-red-600">空き状況の取得に失敗しました</p>;
  }

  if (!data?.slots.length) {
    return <p className="text-sm text-gray-500">この日は定休日または営業時間外です</p>;
  }

  return (
    <div>
      <label className="form-label">時間帯を選択</label>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {data.slots.map((slot: AvailabilitySlot) => {
          const isSelected = selectedSlot === slot.startTime;
          const isFull     = !slot.available;

          return (
            <button
              key={slot.startTime}
              type="button"
              disabled={isFull}
              onClick={() => onSelectSlot(slot.startTime)}
              className={`rounded-md border py-2 text-sm font-medium transition-colors ${
                isFull
                  ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 line-through'
                  : isSelected
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-brand-400'
              }`}
            >
              {slot.startTime}
              {!isFull && (
                <span className="block text-xs text-gray-400">
                  残{Math.max(slot.capacity - slot.currentCount, 0)}
                </span>
              )}
              {isFull && <span className="block text-xs">満員</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

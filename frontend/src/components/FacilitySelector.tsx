import { useQuery } from '@tanstack/react-query';
import { fetchFacilities } from '@/lib/api';
import type { Facility } from '@/types';

interface Props {
  value:    string;
  onChange: (facilityId: string) => void;
}

export function FacilitySelector({ value, onChange }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['facilities'],
    queryFn:  fetchFacilities,
  });

  if (isLoading) return <p className="text-sm text-gray-500">施設を読み込んでいます…</p>;
  if (isError)   return <p className="text-sm text-red-600">施設の取得に失敗しました</p>;

  return (
    <div>
      <label className="form-label">施設を選択</label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {data?.map((facility: Facility) => (
          <button
            key={facility.facilityId}
            type="button"
            onClick={() => onChange(facility.facilityId)}
            className={`rounded-lg border-2 p-4 text-left transition-colors ${
              value === facility.facilityId
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <p className="font-medium">{facility.name}</p>
            <p className="text-sm text-gray-500">定員 {facility.capacity}名</p>
          </button>
        ))}
      </div>
    </div>
  );
}

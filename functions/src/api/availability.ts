import { Router, Request, Response } from 'express';
import { getFacility, getReservationCountsBySlot } from '../infra/firestoreRepository';
import { generateSlots } from '../domain/availability';
import { AvailabilitySlot } from '@shared/types';

const router = Router();

/** GET /availability?facilityId=&date= — 空き枠確認（認証不要） */
router.get('/', async (req: Request, res: Response) => {
  const { facilityId, date } = req.query as Record<string, string>;

  if (!facilityId || !date) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'facilityId と date は必須です' },
    });
    return;
  }

  const facility = await getFacility(facilityId);
  if (!facility) {
    res.status(400).json({
      success: false,
      error: { code: 'FACILITY_NOT_FOUND', message: '施設が見つかりません' },
    });
    return;
  }

  const slotTemplates = generateSlots(facility, date);
  const counts        = await getReservationCountsBySlot(facilityId, date);
  const now           = new Date();
  const todayStr      = now.toISOString().split('T')[0];
  const nowMin        = now.getHours() * 60 + now.getMinutes();

  const slots: AvailabilitySlot[] = slotTemplates.map((s) => {
    const count       = counts.get(s.startTime) ?? 0;
    const [h, m]      = s.startTime.split(':').map(Number);
    const slotMin     = h * 60 + m;
    const isPast      = date < todayStr || (date === todayStr && slotMin <= nowMin);
    const available   = !isPast && count < s.capacity;
    return { ...s, currentCount: count, available };
  });

  res.json({
    success:      true,
    facilityId,
    facilityName: facility.name,
    date,
    slots,
  });
});

export default router;

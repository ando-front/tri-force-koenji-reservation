import { Router, Request, Response } from 'express';
import { getFacility, getReservationSummaryBySlot } from '../infra/firestoreRepository';
import { generateSlots } from '../domain/availability';
import { AvailabilitySlot } from '../../../shared/types';

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
  const counts        = await getReservationSummaryBySlot(facilityId, date);
  const now           = new Date();
  const todayStr      = now.toISOString().split('T')[0];
  const nowMin        = now.getHours() * 60 + now.getMinutes();

  const slots: AvailabilitySlot[] = slotTemplates.map((s) => {
    const summary     = counts.get(s.startTime) ?? { currentCount: 0, reservedNames: [] };
    const [h, m]      = s.startTime.split(':').map(Number);
    const slotMin     = h * 60 + m;
    const isPast      = date < todayStr || (date === todayStr && slotMin <= nowMin);
    const available   = !isPast && summary.currentCount < s.capacity;
    return {
      ...s,
      currentCount: summary.currentCount,
      reservedNames: summary.reservedNames,
      available,
    };
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

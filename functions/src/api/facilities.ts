import { Router, Request, Response } from 'express';
import type { ZodIssue } from 'zod';
import {
  listFacilities,
  listFacilitiesAdmin,
  createFacility,
  updateFacility,
} from '../infra/firestoreRepository';
import { requireAdmin, getActor } from './middleware';
import {
  CreateFacilitySchema,
  UpdateFacilitySchema,
} from '../../../shared/types';

const router = Router();

/** GET /facilities — 施設一覧（認証不要） */
router.get('/', async (_req: Request, res: Response) => {
  const facilities = await listFacilities();
  res.json(facilities);
});

/** GET /facilities/admin — 施設一覧（管理者） */
router.get('/admin', requireAdmin, async (_req: Request, res: Response) => {
  const facilities = await listFacilitiesAdmin();
  res.json({ success: true, facilities });
});

/** POST /facilities/admin — 施設作成（管理者） */
router.post('/admin', requireAdmin, async (req: Request, res: Response) => {
  const parsed = CreateFacilitySchema.safeParse(req.body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    parsed.error.errors.forEach((e: ZodIssue) => {
      fields[e.path.join('.')] = e.message;
    });
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '入力内容を確認してください', fields },
    });
    return;
  }

  try {
    const facility = await createFacility(parsed.data);
    console.log('[facility.created]', getActor(req), facility.facilityId);
    res.status(201).json({ success: true, facility });
  } catch (error) {
    const err = error as { code?: string };
    if (err.code === 'ALREADY_EXISTS') {
      res.status(409).json({
        success: false,
        error: { code: 'ALREADY_EXISTS', message: '同じ施設IDがすでに存在します' },
      });
      return;
    }
    throw error;
  }
});

/** PATCH /facilities/admin/:id — 施設更新（管理者） */
router.patch('/admin/:id', requireAdmin, async (req: Request, res: Response) => {
  const parsed = UpdateFacilitySchema.safeParse(req.body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    parsed.error.errors.forEach((e: ZodIssue) => {
      fields[e.path.join('.')] = e.message;
    });
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '入力内容を確認してください', fields },
    });
    return;
  }

  try {
    const facility = await updateFacility(req.params.id, parsed.data);
    console.log('[facility.updated]', getActor(req), facility.facilityId);
    res.json({ success: true, facility });
  } catch (error) {
    const err = error as { code?: string };
    if (err.code === 'NOT_FOUND') {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '施設が見つかりません' },
      });
      return;
    }
    throw error;
  }
});

export default router;

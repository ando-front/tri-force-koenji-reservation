import { Router, Request, Response } from 'express';
import { listFacilities } from '../infra/firestoreRepository';

const router = Router();

/** GET /facilities — 施設一覧（認証不要） */
router.get('/', async (_req: Request, res: Response) => {
  const facilities = await listFacilities();
  res.json({ success: true, facilities });
});

export default router;

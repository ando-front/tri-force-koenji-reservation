import { Router, Request, Response } from 'express';
import type { ZodIssue } from 'zod';
import {
  getUsageGuideContent,
  setUsageGuideContent,
  writeAuditLog,
} from '../infra/firestoreRepository';
import { getActor, requireAdmin } from './middleware';
import { UpdateUsageGuideContentSchema } from '../../../shared/types';

const router = Router();

/**
 * GET /content/usage-guide — 利用案内文言（公開）
 * 管理者UID等のメタ情報は返さず、表示に必要な配列のみを返す。
 */
router.get('/usage-guide', async (_req: Request, res: Response) => {
  const content = await getUsageGuideContent();
  res.json({
    success: true,
    content: {
      reservationSteps: content.reservationSteps,
      notes:            content.notes,
    },
  });
});

/**
 * GET /content/admin/usage-guide — 利用案内文言（管理者）
 * 編集画面用に updatedAt / updatedBy を含むフルレスポンスを返す。
 */
router.get('/admin/usage-guide', requireAdmin, async (_req: Request, res: Response) => {
  const content = await getUsageGuideContent();
  res.json({ success: true, content });
});

/** PUT /content/admin/usage-guide — 利用案内文言の更新（管理者） */
router.put('/admin/usage-guide', requireAdmin, async (req: Request, res: Response) => {
  const parsed = UpdateUsageGuideContentSchema.safeParse(req.body);
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

  const actor = getActor(req);
  const content = await setUsageGuideContent(parsed.data, actor);
  await writeAuditLog(actor, 'content.updated', 'usage-guide', {
    reservationStepsCount: content.reservationSteps.length,
    notesCount:            content.notes.length,
  });

  res.json({ success: true, content });
});

export default router;

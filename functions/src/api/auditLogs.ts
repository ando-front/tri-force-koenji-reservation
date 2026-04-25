import { Router, Request, Response } from 'express';
import { listAuditLogs } from '../infra/firestoreRepository';
import { requireAdmin } from './middleware';
import { AuditAction, ListAuditLogsQuery } from '../../../shared/types';

const router = Router();

const VALID_ACTIONS: AuditAction[] = [
  'reservation.created',
  'reservation.confirmed',
  'reservation.cancelled',
  'reservation.deleted',
];

/** GET /audit-logs/admin — 監査ログ一覧（管理者） */
router.get('/admin', requireAdmin, async (req: Request, res: Response) => {
  const { action, actor, targetId, limit, cursor } = req.query as Record<string, string>;

  const query: ListAuditLogsQuery = {
    action:   action && VALID_ACTIONS.includes(action as AuditAction) ? (action as AuditAction) : undefined,
    actor:    actor    || undefined,
    targetId: targetId || undefined,
    limit:    limit ? Math.min(Number(limit), 200) : 50,
    cursor:   cursor   || undefined,
  };

  const result = await listAuditLogs(query);
  res.json({ success: true, ...result });
});

export default router;

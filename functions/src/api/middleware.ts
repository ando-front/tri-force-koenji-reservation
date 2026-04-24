import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import * as repo from '../infra/firestoreRepository';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      adminUid?: string;
    }
  }
}

/**
 * Firebase Auth IDトークンを検証し、adminsコレクションに登録された
 * 管理者のみ通す Express ミドルウェア。
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '認証が必要です' } });
    return;
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const adminSnap = await admin
      .firestore()
      .collection('admins')
      .doc(decoded.uid)
      .get();

    if (!adminSnap.exists) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '管理者権限がありません' } });
      return;
    }

    req.adminUid = decoded.uid;
    next();
  } catch {
    res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: '認証トークンが無効です' } });
  }
}

/** 管理者uidをアクター文字列として返す（未認証時は 'system'） */
export function getActor(req: Request): string {
  return req.adminUid ?? 'system';
}

/**
 * シンプルなインメモリのIP別レートリミッタ。
 * Cloud Functions v2 の各インスタンスで独立にカウントされるため
 * 厳密な制限ではないが、総当たり攻撃の抑止には十分。
 *
 * 呼び出し元の Express アプリで `app.set('trust proxy', true)` が
 * 設定されている前提で、`req.ip` から実クライアントIPを取得する。
 * X-Forwarded-For を直接解釈すると偽装ヘッダを通してしまうため使わない。
 */
export function rateLimitByIp(options: {
  windowMs: number;
  max: number;
  key: string;
}): (req: Request, res: Response, next: NextFunction) => void {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  // 期限切れエントリのスイープは短い周期で行い、サイズ上限未満でも
  // メモリを回収できるようにする。
  const cleanupIntervalMs = Math.min(options.windowMs, 60_000);
  let nextCleanupAt = 0;

  return (req, res, next) => {
    const ip = (req.ip ?? 'unknown').trim();
    const cacheKey = `${options.key}:${ip}`;
    const now = Date.now();

    if (now >= nextCleanupAt || buckets.size > 10_000) {
      for (const [k, v] of buckets) {
        if (v.resetAt <= now) buckets.delete(k);
      }
      nextCleanupAt = now + cleanupIntervalMs;
    }

    const bucket = buckets.get(cacheKey);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(cacheKey, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > options.max) {
      const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'リクエストが多すぎます。しばらく経ってから再度お試しください。' },
      });
      return;
    }
    next();
  };
}

/** 共通エラーハンドラ（Expressの4引数エラーハンドラ） */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const error = err as { code?: string; message?: string; status?: number };
  const code    = error.code    ?? 'INTERNAL_ERROR';
  const message = error.message ?? '予期せぬエラーが発生しました';
  const status  = error.status  ?? 500;

  console.error('[error]', code, message);
  repo; // suppress unused import
  res.status(status).json({ success: false, error: { code, message } });
}

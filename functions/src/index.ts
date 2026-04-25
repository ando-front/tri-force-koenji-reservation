import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2/https';
import express from 'express';
import cors from 'cors';

import facilitiesRouter    from './api/facilities';
import availabilityRouter  from './api/availability';
import reservationsRouter  from './api/reservations';
import auditLogsRouter     from './api/auditLogs';
import { errorHandler }    from './api/middleware';

// Firebase Admin SDK の初期化（Cloud Functions環境では資格情報を自動取得）
admin.initializeApp();

const app = express();

// Cloud Functions / Cloud Run は Google Front End 経由でリクエストを受けるため、
// X-Forwarded-For を信頼して req.ip に実クライアントIPを入れる。
// これによりレート制限が偽装ヘッダで回避されないようにする。
app.set('trust proxy', true);

// ─── グローバルミドルウェア ────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    const allowed = (process.env.CORS_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    // 設定がなければ開発用にすべて許可（本番デプロイ時は必ず設定すること）
    if (allowed.length === 0 || !origin || allowed.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error('CORS: origin not allowed'));
    }
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));

// ─── ルーティング ──────────────────────────────────────────────────────────────
app.use('/facilities',   facilitiesRouter);
app.use('/availability', availabilityRouter);
app.use('/reservations', reservationsRouter);
app.use('/audit-logs',   auditLogsRouter);

// 管理者エクスポートルートは /reservations 内に定義済み

// ─── エラーハンドラ ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Cloud Functions エクスポート ─────────────────────────────────────────────
export const api = functions.onRequest(
  {
    region:       'asia-northeast1', // 東京
    maxInstances: 10,                // DDoS対策・コスト上限
    memory:       '256MiB',
    timeoutSeconds: 30,
    invoker:      'public',
  },
  app
);

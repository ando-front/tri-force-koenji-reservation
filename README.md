# Tri-force Koenji 施設予約システム

トライフォース高円寺向けの施設予約システムです。会員がフィットネスルームとフリーマットを時間帯ごとに予約できます。

**ステータス**: 本番稼働中

**本番URL**: `https://tri-force-koenji-reservation.web.app`

---

## 機能一覧

- 施設予約（フリーマット / フィットネス、1時間単位）
- 空き状況グリッド（日付・施設ごとに一覧表示、予約者名を公開表示）
- 予約者名公開表示（他の利用者が誰が予約しているか確認可能）
- 施設管理（定休日・メンテナンス日・定員・営業時間の設定）
- 管理画面（予約一覧・キャンセル・施設管理、Googleアカウント認証）
- メール通知（予約確認メールを Resend 経由で送信）
- 利用案内ページ（`/guide`）

---

## システム構成

```
ブラウザ
  │ HTTPS
  ▼
Firebase Hosting (React SPA)
  │ HTTPS / REST API
  ▼
Cloud Functions v2 (Express, TypeScript, asia-northeast1)
  │
  ├─→ Cloud Firestore（予約・施設データ）
  └─→ Firebase Authentication（管理者ログイン）
```

**技術スタック:**

| 層 | 技術 |
|---|---|
| フロントエンド | React 18 + Vite + TypeScript + Tailwind CSS |
| バックエンド | Cloud Functions v2 (Node.js 20, TypeScript, Express) |
| データベース | Cloud Firestore |
| 認証 | Firebase Authentication (Googleログイン) |
| メール | Resend |
| ホスティング | Firebase Hosting |
| CI/CD | GitHub Actions |

---

## プロジェクト構造

```
tri-force-koenji-reservation/
├── frontend/          # React SPA（ユーザー向け予約 + 管理画面）
├── functions/         # Cloud Functions v2 (Express API)
├── shared/            # フロントエンド・バックエンド共有の型定義
├── firebase.json      # Firebase設定
├── firestore.rules    # Firestoreセキュリティルール
├── firestore.indexes.json
├── .firebaserc
├── docs/              # 設計書・運用手順書
└── .github/workflows/ # CI/CD (ci.yml, deploy.yml, staging.yml)
```

---

## ページ・URL

| パス | 説明 |
|---|---|
| `/` | 予約ページ（施設選択・日付・空き状況・予約入力） |
| `/guide` | 利用案内・留意事項 |
| `/complete` | 予約完了ページ |
| `/admin/login` | 管理者ログイン |
| `/admin` | 予約一覧（管理者のみ） |
| `/admin/reservations/:id` | 予約詳細・キャンセル（管理者のみ） |
| `/admin/facilities` | 施設管理（管理者のみ） |

管理画面へのリンクは予約ページには掲載していません。管理者は `/admin/login` に直接アクセスしてください。

---

## ローカル開発

### 前提条件

- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)

### セットアップ

```bash
# Functions
cd functions
npm install
cp .env.example .env.local   # 環境変数を設定
npm run build

# Frontend
cd frontend
npm install
cp .env.example .env.local   # 環境変数を設定
npm run dev
```

### エミュレーター起動

```bash
# ルートディレクトリで
firebase emulators:start --only functions,firestore,auth,hosting
```

### テスト

```bash
cd functions
npm test
```

---

## デプロイ

`main` ブランチへのプッシュで GitHub Actions が自動実行されます。

1. Functions ビルド（TypeScript → JavaScript）
2. Frontend ビルド（Vite）
3. Firebase Hosting へデプロイ
4. Cloud Functions へデプロイ

手動デプロイが必要な場合:

```bash
firebase deploy --project tri-force-koenji-reservation
```

---

## 施設マスタの初期化

新規環境を構築した際は seed スクリプトで施設データを投入してください。

```bash
cd functions
export FIREBASE_SERVICE_ACCOUNT_PATH="path/to/serviceaccount.json"
export GOOGLE_CLOUD_PROJECT="tri-force-koenji-reservation"
npm run seed:facilities
```

---

## 環境変数

### functions/.env

| 変数名 | 説明 |
|---|---|
| `RESEND_API_KEY` | Resend APIキー |
| `MAIL_FROM` | 送信元メールアドレス |
| `ADMIN_MAIL_BCC` | 管理者BCC先 |
| `ALLOWED_ORIGINS` | CORSを許可するオリジン（カンマ区切り） |

### frontend/.env

| 変数名 | 説明 |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase Web APIキー |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth ドメイン |
| `VITE_FIREBASE_PROJECT_ID` | Firebase プロジェクトID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage バケット |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Messaging Sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase App ID |
| `VITE_FUNCTIONS_BASE_URL` | Cloud Functions のベースURL |
| `VITE_USE_EMULATORS` | `'true'` でエミュレーター使用 |

---

## ドキュメント

| ファイル | 内容 |
|---|---|
| [docs/設計書.md](docs/設計書.md) | アーキテクチャ、DB設計、API設計 |
| [docs/運用手順書.md](docs/運用手順書.md) | デプロイ・運用手順 |

---

## ライセンス

Apache License 2.0

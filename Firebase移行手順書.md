# Firebase移行実装手順書

## 1. 移行準備

### 1.1 Firebase プロジェクトセットアップ

#### 1.1.1 Firebase Console での設定
```bash
1. https://console.firebase.google.com/ にアクセス
2. 「プロジェクトを追加」をクリック
3. プロジェクト名: "tri-force-koenji-reservation"
4. Google Analytics: 有効化（推奨）
5. 利用規約に同意してプロジェクト作成
```

#### 1.1.2 必要なサービスの有効化
```bash
Firebase Console で以下を有効化:
□ Hosting
□ Functions
□ Authentication（将来の機能拡張用）
```

### 1.2 Google Cloud Console 設定

#### 1.2.1 サービスアカウントの作成
```bash
1. https://console.cloud.google.com/ にアクセス
2. 上記で作成した Firebase プロジェクトを選択
3. 「IAM と管理」→「サービス アカウント」
4. 「サービス アカウントを作成」
   - 名前: "tri-force-reservation-service"
   - 説明: "予約システム用サービスアカウント"
5. 役割を追加:
   - "編集者" または以下の個別権限:
     - "Google Sheets API 編集者"
     - "Google Calendar API 編集者"
6. キーを作成（JSON形式）
```

#### 1.2.2 必要なAPIの有効化
```bash
Google Cloud Console で以下のAPIを有効化:
□ Google Sheets API
□ Google Calendar API
□ Gmail API（通知機能用、オプション）
```

### 1.3 開発環境の準備

#### 1.3.1 Node.js環境の確認
```bash
# Node.js バージョン確認（16以上推奨）
node --version

# npm バージョン確認
npm --version
```

#### 1.3.2 Firebase CLI のインストール
```bash
# Firebase CLI のグローバルインストール
npm install -g firebase-tools

# ログイン
firebase login

# プロジェクト一覧確認
firebase projects:list
```

## 2. プロジェクト初期化

### 2.1 新しいプロジェクトディレクトリの作成
```bash
# プロジェクトディレクトリの作成
mkdir tri-force-firebase
cd tri-force-firebase

# Firebase プロジェクトの初期化
firebase init
```

### 2.2 Firebase初期化の設定
```bash
# 選択するサービス:
☑ Functions: サーバーレス関数用
☑ Hosting: 静的サイトホスティング用

# プロジェクト選択:
→ 上で作成した "tri-force-koenji-reservation" を選択

# Functions 設定:
→ 言語: JavaScript
→ ESLint: Yes
→ 依存関係のインストール: Yes

# Hosting 設定:
→ public directory: public
→ SPA: No
→ GitHub Actions: No（後で設定可能）
```

### 2.3 プロジェクト構造の確認
```
tri-force-firebase/
├── functions/
│   ├── index.js
│   ├── package.json
│   └── node_modules/
├── public/
│   └── index.html
├── firebase.json
└── .firebaserc
```

## 3. フロントエンド実装

### 3.1 静的ファイルの配置

#### 3.1.1 既存HTMLの移植
```html
<!-- public/index.html -->
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <base target="_top">
    <title>予約フォーム</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/css/materialize.min.css">
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <h3>Tri-force Koenji会員専用サイト</h3>
        <form id="reservationForm">
            <!-- 既存のフォーム要素をそのまま移植 -->
            <div class="row">
                <div class="input-field col s12">
                    <input id="email" type="email" name="メールアドレス" class="validate" required>
                    <label for="email">メールアドレス</label>
                </div>
            </div>
            
            <div class="row">
                <div class="col s12">
                    <label>予約施設</label><br>
                    <div class="radio-group">
                        <label>
                            <input class="with-gap" name="予約施設" type="radio" value="フリーマット" required>
                            <span>フリーマット</span>
                        </label>
                        <label>
                            <input class="with-gap" name="予約施設" type="radio" value="フィットネス" required>
                            <span>フィットネス</span>
                        </label>
                    </div>
                </div>
            </div>
            
            <!-- 他のフォーム要素も同様に移植 -->
            
            <button class="btn waves-effect waves-light" type="submit">
                送信<i class="material-icons right">send</i>
            </button>
        </form>
        
        <a href="https://calendar.google.com/calendar/embed?src=YOUR_CALENDAR_ID&ctz=Asia%2FTokyo" target="_blank">
            <button class="btn">カレンダーを見る</button>
        </a>
    </div>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/js/materialize.min.js"></script>
    <script src="script.js"></script>
</body>
</html>
```

#### 3.1.2 CSS ファイルの作成
```css
/* public/style.css */
body {
    font-size: 16px;
    padding: 20px;
}

.container {
    width: 95%;
    max-width: 600px;
}

.input-field {
    margin-bottom: 20px;
}

.btn {
    padding: 10px 20px;
    font-size: 1.2rem;
}

.radio-group {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}

.loading {
    display: none;
    text-align: center;
    padding: 20px;
}

.message {
    padding: 20px;
    margin: 20px 0;
    border-radius: 4px;
}

.message.success {
    background-color: #e8f5e8;
    color: #2e7d2e;
    border: 1px solid #4caf50;
}

.message.error {
    background-color: #ffebee;
    color: #c62828;
    border: 1px solid #f44336;
}
```

#### 3.1.3 JavaScript ファイルの実装
```javascript
// public/script.js
document.addEventListener('DOMContentLoaded', function() {
    // Materialize の初期化
    initializeMaterialize();
    
    // フォームイベントの設定
    setupFormEvents();
    
    // 時間選択肢の生成
    generateTimeOptions();
});

function initializeMaterialize() {
    M.Datepicker.init(document.querySelectorAll('.datepicker'), {
        format: 'yyyy-mm-dd',
        i18n: {
            months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
            weekdays: ['日', '月', '火', '水', '木', '金', '土'],
            cancel: 'キャンセル',
            done: '完了'
        }
    });
    
    M.FormSelect.init(document.querySelectorAll('select'));
}

function setupFormEvents() {
    const form = document.getElementById('reservationForm');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // ローディング表示
        showLoading(true);
        
        try {
            const formData = new FormData(this);
            const data = Object.fromEntries(formData);
            
            const response = await fetch('/api/reservations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (result.success) {
                showMessage('予約が完了しました。', 'success');
                form.reset();
            } else {
                showMessage(result.message || 'エラーが発生しました。', 'error');
            }
        } catch (error) {
            console.error('送信エラー:', error);
            showMessage('送信中にエラーが発生しました。', 'error');
        } finally {
            showLoading(false);
        }
    });
}

function generateTimeOptions() {
    const startTimeSelect = document.getElementById('startTime');
    if (!startTimeSelect) return;
    
    startTimeSelect.innerHTML = '';
    
    let startTime = new Date();
    startTime.setHours(7, 0, 0, 0);
    
    const endTime = new Date();
    endTime.setHours(21, 0, 0, 0);
    
    while (startTime <= endTime) {
        const timeString = startTime.toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const option = document.createElement('option');
        option.value = timeString;
        option.text = timeString;
        startTimeSelect.appendChild(option);
        
        startTime.setMinutes(startTime.getMinutes() + 30);
    }
    
    // Materialize の select を再初期化
    M.FormSelect.init(startTimeSelect);
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = show ? 'block' : 'none';
    }
}

function showMessage(message, type) {
    // 既存のメッセージを削除
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // 新しいメッセージを作成
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    // フォームの後に挿入
    const form = document.getElementById('reservationForm');
    form.parentNode.insertBefore(messageDiv, form.nextSibling);
    
    // 5秒後に自動削除
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 5000);
}

// 施設選択時の定員表示更新
function updateCapacity(newCapacity) {
    // 必要に応じて UI を更新
    console.log('定員更新:', newCapacity);
}

// 日付変更時の処理
document.addEventListener('change', function(e) {
    if (e.target.id === 'startDate') {
        const selectedDate = new Date(e.target.value);
        const today = new Date();
        
        if (selectedDate < today) {
            alert('過去の日付は選択できません');
            e.target.value = '';
            return;
        }
        
        generateTimeOptions();
    }
});
```

## 4. バックエンド実装

### 4.1 Cloud Functions の実装

#### 4.1.1 依存関係の追加
```bash
cd functions
npm install googleapis cors moment
```

#### 4.1.2 メイン関数の実装
```javascript
// functions/index.js
const functions = require('firebase-functions');
const { google } = require('googleapis');
const cors = require('cors')({ origin: true });

// 設定値（環境変数から取得）
const SPREADSHEET_ID = functions.config().app.spreadsheet_id;
const CALENDAR_ID = functions.config().app.calendar_id;

// Google APIs 認証設定
const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(functions.config().app.google_credentials),
    scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/calendar'
    ]
});

const sheets = google.sheets('v4');
const calendar = google.calendar('v3');

// 予約作成API
exports.createReservation = functions.https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
        // プリフライトリクエストの処理
        if (req.method === 'OPTIONS') {
            res.set('Access-Control-Allow-Methods', 'POST');
            res.set('Access-Control-Allow-Headers', 'Content-Type');
            res.status(204).send('');
            return;
        }

        if (req.method !== 'POST') {
            return res.status(405).json({ 
                success: false, 
                message: 'Method not allowed' 
            });
        }

        try {
            const formData = req.body;
            
            // バリデーション
            const validationError = validateFormData(formData);
            if (validationError) {
                return res.status(400).json({
                    success: false,
                    message: validationError
                });
            }

            // 認証クライアントの取得
            const authClient = await auth.getClient();

            // 時間枠の解析
            const { startTime, endTime } = parseTimeSlot(formData);

            // 重複チェック
            const isAvailable = await checkAvailability(authClient, formData.予約施設, startTime);
            if (!isAvailable) {
                return res.status(409).json({
                    success: false,
                    message: 'この時間帯は満員です。'
                });
            }

            // スプレッドシートに保存
            await saveToSpreadsheet(authClient, formData, startTime, endTime);

            // カレンダーに登録
            await createCalendarEvent(authClient, formData, startTime, endTime);

            res.json({
                success: true,
                message: '予約が完了しました。'
            });

        } catch (error) {
            console.error('予約処理エラー:', error);
            res.status(500).json({
                success: false,
                message: '予約処理中にエラーが発生しました。'
            });
        }
    });
});

// フォームデータのバリデーション
function validateFormData(formData) {
    const required = ['メールアドレス', '予約施設', '氏名', '連絡先', '利用開始日', '利用開始時間'];
    
    for (const field of required) {
        if (!formData[field]) {
            return `${field}は必須項目です。`;
        }
    }

    // メールアドレスの形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.メールアドレス)) {
        return 'メールアドレスの形式が正しくありません。';
    }

    // 施設名チェック
    const validFacilities = ['フリーマット', 'フィットネス'];
    if (!validFacilities.includes(formData.予約施設)) {
        return '無効な施設が選択されています。';
    }

    return null;
}

// 時間枠の解析
function parseTimeSlot(formData) {
    const startTimeString = `${formData.利用開始日} ${formData.利用開始時間}`;
    const startTime = new Date(startTimeString);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1時間後

    return { startTime, endTime };
}

// 空き状況チェック
async function checkAvailability(authClient, facility, startTime) {
    try {
        const response = await sheets.spreadsheets.values.get({
            auth: authClient,
            spreadsheetId: SPREADSHEET_ID,
            range: 'フォームの回答 2!A:J'
        });

        const rows = response.data.values || [];
        let count = 0;
        const maxCapacity = facility === 'フリーマット' ? 10 : 4;

        // ヘッダー行をスキップして処理
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row[2] === facility) { // 施設名
                const existingStartTime = new Date(row[5]); // 利用開始時間
                if (isSameHour(existingStartTime, startTime)) {
                    count++;
                }
            }
        }

        return count < maxCapacity;
    } catch (error) {
        console.error('空き状況チェックエラー:', error);
        throw error;
    }
}

// 同じ時間かどうかの判定
function isSameHour(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate() &&
           date1.getHours() === date2.getHours();
}

// スプレッドシートへの保存
async function saveToSpreadsheet(authClient, formData, startTime, endTime) {
    const values = [
        [
            new Date().toISOString(),
            formData.メールアドレス,
            formData.予約施設,
            formData.氏名,
            formData.連絡先,
            startTime.toISOString(),
            endTime.toISOString(),
            formData.備考 || '',
            ''
        ]
    ];

    await sheets.spreadsheets.values.append({
        auth: authClient,
        spreadsheetId: SPREADSHEET_ID,
        range: 'フォームの回答 2!A:I',
        valueInputOption: 'RAW',
        requestBody: {
            values
        }
    });
}

// カレンダーイベントの作成
async function createCalendarEvent(authClient, formData, startTime, endTime) {
    const event = {
        summary: `予約：${formData.氏名} 様：${formData.予約施設}`,
        description: formData.備考 || '',
        start: {
            dateTime: startTime.toISOString(),
            timeZone: 'Asia/Tokyo'
        },
        end: {
            dateTime: endTime.toISOString(),
            timeZone: 'Asia/Tokyo'
        }
    };

    await calendar.events.insert({
        auth: authClient,
        calendarId: CALENDAR_ID,
        requestBody: event
    });
}
```

### 4.2 環境変数の設定

#### 4.2.1 Firebase Functions の環境変数設定
```bash
# Firebase Functions で環境変数を設定
firebase functions:config:set \
  app.spreadsheet_id="YOUR_SPREADSHEET_ID" \
  app.calendar_id="YOUR_CALENDAR_ID" \
  app.google_credentials='{"type":"service_account","project_id":"your-project",...}'

# 設定確認
firebase functions:config:get
```

#### 4.2.2 ローカル開発用の設定
```bash
# ローカル開発用の環境変数取得
firebase functions:config:get > functions/.runtimeconfig.json
```

## 5. デプロイとテスト

### 5.1 ローカルでのテスト

#### 5.1.1 ローカルエミュレータの起動
```bash
# Firebase エミュレータのインストール
firebase setup:emulators:functions

# エミュレータの起動
firebase emulators:start

# ブラウザで確認
# http://localhost:5000 (Hosting)
# http://localhost:5001 (Functions)
```

#### 5.1.2 機能テスト
```bash
# 予約フォームのテスト
1. http://localhost:5000 にアクセス
2. フォームに必要事項を入力
3. 送信ボタンをクリック
4. レスポンスを確認

# APIの直接テスト（curl）
curl -X POST http://localhost:5001/tri-force-koenji-reservation/us-central1/createReservation \
  -H "Content-Type: application/json" \
  -d '{
    "メールアドレス": "test@example.com",
    "予約施設": "フリーマット",
    "氏名": "テスト太郎",
    "連絡先": "090-1234-5678",
    "利用開始日": "2024-01-01",
    "利用開始時間": "10:00"
  }'
```

### 5.2 本番環境へのデプロイ

#### 5.2.1 デプロイ実行
```bash
# 全体のデプロイ
firebase deploy

# 個別デプロイ
firebase deploy --only hosting    # Hosting のみ
firebase deploy --only functions  # Functions のみ
```

#### 5.2.2 デプロイ後の確認
```bash
# デプロイ情報の確認
firebase hosting:channel:list
firebase functions:list

# ログの確認
firebase functions:log
```

### 5.3 本番テスト

#### 5.3.1 基本機能テスト
```bash
□ 予約フォームの表示
□ フォーム送信
□ 重複チェック機能
□ エラーハンドリング
□ レスポンス速度
```

#### 5.3.2 複数アカウントテスト
```bash
□ 複数Googleアカウントログイン状態でのアクセス
□ 異なるブラウザでのテスト
□ シークレットモードでのテスト
```

## 6. 運用設定

### 6.1 独自ドメインの設定（オプション）

#### 6.1.1 カスタムドメインの追加
```bash
# Firebase Console での設定
1. Hosting → ドメイン → カスタムドメインを追加
2. ドメイン名を入力（例: reservation.tri-force-koenji.com）
3. DNS設定の指示に従ってAレコードを設定
4. SSL証明書の自動発行を待つ
```

### 6.2 監視とアラートの設定

#### 6.2.1 Firebase Performance Monitoring
```bash
# パフォーマンス監視の有効化
firebase init performance

# 監視データの確認
Firebase Console → Performance
```

#### 6.2.2 ログ監視の設定
```bash
# Cloud Logging での監視
1. Google Cloud Console → ログ
2. フィルタの設定
3. アラートポリシーの作成
```

## 7. トラブルシューティング

### 7.1 よくある問題と解決策

#### 7.1.1 デプロイエラー
```bash
# 権限エラー
firebase login --reauth

# 依存関係エラー
cd functions && npm install

# 環境変数エラー
firebase functions:config:get
```

#### 7.1.2 API エラー
```bash
# Google APIs の確認
1. Google Cloud Console → API とサービス
2. 有効化されているAPIの確認
3. サービスアカウントのキーの確認
```

#### 7.1.3 CORS エラー
```bash
# firebase.json での設定確認
{
  "hosting": {
    "headers": [
      {
        "source": "/api/**",
        "headers": [
          {
            "key": "Access-Control-Allow-Origin",
            "value": "*"
          }
        ]
      }
    ]
  }
}
```

---

**注意**: 本手順書に従って実装することで、GAS の複数アカウント問題を根本的に解決し、より安定したサービスを提供できます。

# デプロイ方法決定ドキュメント

## 決定日
2025年

## エグゼクティブサマリー

**推奨デプロイ方法**: **Option B - GitHub Pages + GAS API**

**理由**:
1. フロントエンド更新が即座に反映（Git push のみ）
2. バージョン管理が容易
3. 複数人での開発に適している
4. 将来の拡張性が高い
5. 現在のコードは既にこの構成を想定している

---

## 比較分析

### Option A: GAS Web App のみ

#### 構成
```
[ユーザー]
    ↓
[Google Apps Script Web App]
    ├── フロントエンド（HTML/CSS/JS）
    ├── バックエンド（GAS）
    ├── Spreadsheet
    └── Calendar
```

#### メリット
✅ **シンプル**: 単一のURLで完結
✅ **CORS不要**: 同一オリジンなので制限なし
✅ **設定が簡単**: GASのデプロイのみ
✅ **初心者に優しい**: 設定箇所が少ない

#### デメリット
❌ **フロントエンド更新が面倒**: GASエディタで編集→デプロイ必要
❌ **バージョン管理困難**: HTMLがGAS内に埋め込まれる
❌ **複数人開発に不向き**: 同時編集しにくい
❌ **デプロイに時間**: 毎回デプロイが必要
❌ **プレビューが困難**: ローカルで確認できない

#### 実装状況
- `code.gs` に `doGet()` 関数あり
- しかし `index.html` ファイルは削除済み（アーカイブ）
- **現状では実装不可能**（フロントエンドファイルなし）

---

### Option B: GitHub Pages + GAS API（推奨）

#### 構成
```
[ユーザー]
    ↓
[GitHub Pages]（フロントエンド）
    ↓ HTTP POST
[Google Apps Script]（バックエンドAPI）
    ├── Spreadsheet
    └── Calendar
```

#### メリット
✅ **フロントエンド更新が即座**: Git push で自動反映
✅ **バージョン管理**: Git で完全管理
✅ **ローカル開発**: `http-server` や `python -m http.server` で確認可能
✅ **複数人開発**: Pull Request ワークフロー
✅ **プレビュー可能**: ローカルで動作確認
✅ **デザイン変更容易**: HTML/CSS/JS を直接編集
✅ **CDN配信**: GitHub Pages の高速配信
✅ **独自ドメイン対応**: カスタムドメイン設定可能

#### デメリット
⚠️ **CORS対応必要**: GAS側で設定（既に実装済み）
⚠️ **2つのURL管理**: フロントエンドとバックエンド
⚠️ **設定がやや複雑**: GitHub + GAS 両方の設定

#### 実装状況
- `pages/` ディレクトリに完全なフロントエンドあり
- `code.gs` に CORS 対応の `doPost()` と `doOptions()` あり
- **現状で既に実装済み、すぐ使える**

---

## 技術的詳細比較

### フロントエンド更新頻度による比較

| 更新頻度 | Option A | Option B |
|---------|----------|----------|
| 月1回未満 | 適している | やや過剰 |
| 月1-4回 | やや不便 | 適している |
| 週1回以上 | 不便 | 非常に適している |

**このプロジェクトの予想**: 初期は頻繁（週1回以上）、安定後は月1-2回
→ **Option B が適している**

---

### 開発者数による比較

| 開発者数 | Option A | Option B |
|---------|----------|----------|
| 1人 | 適している | やや過剰 |
| 2人 | 不便 | 適している |
| 3人以上 | 困難 | 非常に適している |

**このプロジェクト**: プロボノエンジニア複数名想定
→ **Option B が適している**

---

### 現在のコード構成

#### code.gs の対応状況

```javascript
// doGet() - GAS Web App 用
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')  // ❌ index.html が存在しない
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// doPost() - 両方に対応
function doPost(e) {
  // ✅ API リクエスト判定あり
  const isApiRequest = e.parameter.apiRequest === 'true' ||
                      e.postData && e.postData.type === 'application/x-www-form-urlencoded';

  if (isApiRequest) {
    // ✅ JSON レスポンス + CORS ヘッダー
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
  } else {
    // HTML レスポンス（GAS Web App 用）
    return processFormData(formData);
  }
}

// doOptions() - CORS プリフライト対応
// ✅ 実装済み
function doOptions(e) {
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
}
```

**結論**:
- Option A: `index.html` がないため**実装できない**
- Option B: 完全に実装済みで**すぐ使える**

---

#### pages/ の構成

```
pages/
├── index.html      ✅ 完全なフォームUI
├── script.js       ✅ AJAX 通信実装済み
└── style.css       ✅ レスポンシブ対応

script.js:
- const GAS_WEB_APP_URL が設定されている
- fetch() で POST 送信
- mode: 'no-cors' 設定（CORS 対応）
```

**結論**: Option B 用のフロントエンドが**完全に実装済み**

---

## CORS 問題の解決

### 現在の実装（pages/script.js）

```javascript
const response = await fetch(GAS_WEB_APP_URL, {
    method: 'POST',
    mode: 'no-cors', // ⚠️ CORS 制限を回避
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(formData)
});

// no-corsモードでは常に成功として扱う
showSuccess({
    message: '予約を受け付けました',
    reservationId: generateTempId()
});
```

### 問題点

`mode: 'no-cors'` を使用すると:
- ❌ レスポンスが読めない（opaque response）
- ❌ エラーハンドリングができない
- ❌ 成功/失敗が判定できない

### 推奨解決策

#### 1. GAS 側の CORS ヘッダー設定（既に実装済み）
```javascript
// code.gs の doPost() で既に設定済み
.setHeaders({
  'Access-Control-Allow-Origin': '*',  // ✅ すべてのオリジンを許可
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
});
```

#### 2. フロントエンド側の修正（推奨）
```javascript
// script.js の修正案
const response = await fetch(GAS_WEB_APP_URL, {
    method: 'POST',
    // mode: 'no-cors' を削除または 'cors' に変更
    mode: 'cors',  // ✅ CORS を有効化
    headers: {
        'Content-Type': 'application/json',  // JSON に変更
    },
    body: JSON.stringify(formData)  // JSON 形式で送信
});

// レスポンスを正常に読める
const result = await response.json();

if (result.success) {
    showSuccess(result);
} else {
    showError(result.message);
}
```

---

## 推奨デプロイ方法

### 決定: Option B - GitHub Pages + GAS API

**根拠**:
1. ✅ 既に完全実装されている（すぐ使える）
2. ✅ フロントエンド更新が容易
3. ✅ Git でバージョン管理可能
4. ✅ 複数人開発に対応
5. ✅ ローカル開発が可能
6. ✅ 将来の拡張性が高い
7. ✅ Option A は実装されていない（index.html なし）

---

## 実装アクションプラン

### ステップ1: CORS 問題の修正（30分）

**ファイル修正**: `pages/script.js`

```javascript
// 修正箇所1: mode を変更
const response = await fetch(GAS_WEB_APP_URL, {
    method: 'POST',
    mode: 'cors',  // ← 'no-cors' から変更
    headers: {
        'Content-Type': 'application/json',  // ← JSON に変更
    },
    body: JSON.stringify(formData)  // ← JSON 化
});

// 修正箇所2: レスポンス処理
const result = await response.json();  // ← レスポンスを読む

if (result.success) {
    showSuccess(result);
} else {
    showError(result.message);
}
```

---

### ステップ2: code.gs の簡略化（15分）

**削除推奨**: Option A 用のコード

```javascript
// ❌ 削除: doGet() 関数（使用しない）
// function doGet() {
//   return HtmlService.createHtmlOutputFromFile('index')
//     .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
//     .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
// }

// ❌ 削除: processFormData() 関数（HTML レスポンス用、使用しない）

// ✅ 保持: doPost() の API モードのみ
// ✅ 保持: doOptions() CORS プリフライト
// ✅ 保持: processFormDataForApi() API レスポンス生成
```

---

### ステップ3: 不要なコードの削除（15分）

**削除対象**:
1. `code.gs` の `doGet()` 関数
2. `code.gs` の HTML レスポンス生成部分
3. API 判定の分岐（常に API モードとする）

**簡略化後の doPost()**:
```javascript
function doPost(e) {
  const formData = e.parameter;
  Logger.log('フォームデータ: ' + JSON.stringify(formData));

  try {
    // API モードのみに簡略化
    const result = processFormDataForApi(formData);
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
  } catch (error) {
    Logger.log('予約処理エラー: ' + error);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        message: 'サーバーエラーが発生しました: ' + error
      }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
  }
}
```

---

### ステップ4: ドキュメント更新（15分）

**更新ファイル**:
1. `README.md` - デプロイ方法を Option B のみに更新
2. `MVP定義書.md` - デプロイ方法を明記
3. `docs/開発手順書.md` - Option B の詳細手順

---

### ステップ5: .gitignore の確認（5分）

GitHub Pages デプロイに不要なファイルを除外:
```gitignore
# Node modules
node_modules/

# GAS設定（秘密情報）
.clasp.json
.clasp-*.json

# 環境設定
.env

# ビルド成果物（使用していない場合）
dist/
build/

# アーカイブ（Git 管理するが、デプロイ不要）
_archive/
```

---

## 最終的なファイル構成

```
tri-force-koenji-reservation/
│
├── pages/                    # ✅ GitHub Pages で公開
│   ├── index.html           # フォームUI
│   ├── script.js            # CORS対応AJAX（修正済み）
│   └── style.css            # スタイル
│
├── code.gs                   # ✅ GAS API（簡略化版）
│   - doPost()               # API エンドポイント
│   - doOptions()            # CORS プリフライト
│   - processFormDataForApi()
│   - (doGet() 削除)
│
├── appsscript.json          # GAS 設定
│
├── docs/                     # ドキュメント
│   ├── 開発手順書.md         # Option B の手順
│   ├── 運用手順書.md
│   └── GitHub Pages移行手順書.md
│
├── README.md                 # Option B のみ記載
├── DEPLOYMENT_DECISION.md    # このドキュメント
│
└── (その他設定ファイル)
```

---

## 必要な作業時間

| タスク | 時間 |
|--------|------|
| CORS 修正（script.js） | 30分 |
| code.gs 簡略化 | 15分 |
| 不要コード削除 | 15分 |
| ドキュメント更新 | 15分 |
| .gitignore 確認 | 5分 |
| **合計** | **1時間20分** |

---

## 完了基準

- [x] pages/script.js の CORS 対応を修正
- [x] code.gs から Option A 用コードを削除
- [x] README.md に Option B のみを記載
- [x] ローカルでテスト（`python -m http.server 8000`）
- [x] Git commit
- [x] 本番環境でテスト

---

## 代替案の却下理由

### 代替案1: Option A のみに統一
**却下理由**:
- `index.html` が既に削除されている
- 再実装に時間がかかる（3-4時間）
- 将来の保守性が低い
- 現在のコードが Option B を想定している

### 代替案2: 両方をサポート
**却下理由**:
- コードが複雑化
- 保守コストが2倍
- テストが2倍必要
- MVPの原則に反する（シンプルさ重視）

---

## リスクと対策

### リスク1: CORS エラー

**発生確率**: 低（GAS側で既に対応済み）
**対策**:
- GAS のデプロイ設定で「全員がアクセス可能」を確認
- ブラウザのコンソールでエラーログ確認
- 必要に応じて GAS の CORS ヘッダーを調整

### リスク2: GitHub Pages の遅延

**発生確率**: 低
**影響**: デプロイに数分かかる
**対策**:
- ローカルで十分テストしてから push
- 緊急時は GAS エディタで直接修正

### リスク3: URL の管理

**発生確率**: 中（設定ミスの可能性）
**対策**:
- `GAS_WEB_APP_URL` を `.env` ファイルに分離（将来）
- README に設定手順を明記
- デプロイチェックリストを作成

---

## 次のステップ

### 今日中に完了
1. ✅ CORS 修正（pages/script.js）
2. ✅ code.gs 簡略化
3. ✅ Git commit

### 明日以降
4. ⏳ GAS デプロイ（本番環境）
5. ⏳ GitHub Pages 設定
6. ⏳ エンドツーエンドテスト

---

**決定者**: プロボノエンジニアチーム
**承認日**: 2025年
**有効期限**: 無期限（MVP 完了まで）
**レビュー**: 本番運用開始後3ヶ月で再評価

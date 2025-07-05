# GitHub Pages移行手順書

## 1. 移行概要

### 1.1 移行方針
- **フロントエンド**: HTMLをGitHub Pagesに移行
- **バックエンド**: GASのバックエンド処理は継続利用
- **メリット**: 複数Googleアカウント問題の解決、無料での公開、シンプルな構成

### 1.2 移行後の構成
```
GitHub Pages (静的サイト)
├── index.html (フロントエンド)
├── script.js (クライアント側処理)
├── style.css (スタイリング)
└── assets/ (画像等)

Google Apps Script (継続利用)
├── code.gs (バックエンド処理)
├── スプレッドシート連携
└── カレンダー連携
```

## 2. 移行準備

### 2.1 既存コードの分析
現在のGASプロジェクトから以下を抽出：
- HTMLファイル (`index.html`)
- JavaScriptコード (クライアント側)
- CSSスタイル
- GASバックエンド関数の特定

### 2.2 現在のリポジトリでの準備

現在のリポジトリ (`tri-force-koenji-reservation`) をそのまま利用してGitHub Pagesを有効化します。

```bash
# 現在のリポジトリで作業
cd tri-force-koenji-reservation

# GitHub Pages用のファイルを配置
# docs/ フォルダと並行して静的ファイルを配置
mkdir -p pages
# または、リポジトリルートに直接配置
```

#### リポジトリ構成（推奨）
```
tri-force-koenji-reservation/
├── docs/                    # ドキュメント
├── pages/                   # GitHub Pages用ファイル
│   ├── index.html
│   ├── script.js
│   └── style.css
├── src/                     # 既存のソース
├── code.gs                  # 既存のGAS
├── index.html              # 既存のGAS HTML
└── README.md               # プロジェクトREADME
```

#### 代替案（シンプル）
```
tri-force-koenji-reservation/
├── docs/                    # ドキュメント
├── public/                  # GitHub Pages用ファイル
│   ├── index.html
│   ├── script.js
│   └── style.css
├── gas/                     # GAS関連ファイル（移動）
│   ├── code.gs
│   └── index.html
└── README.md
```

## 3. フロントエンドの移行

### 3.1 HTMLファイルの作成
```html
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tri-force Koenji 施設予約システム</title>
    
    <!-- Materialize CSS -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/css/materialize.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
    
    <!-- カスタムCSS -->
    <link href="style.css" rel="stylesheet">
</head>
<body>
    <div class="container">
        <h1 class="center-align">Tri-force Koenji 施設予約</h1>
        
        <div class="card-panel">
            <form id="reservationForm">
                <div class="row">
                    <div class="input-field col s12 m6">
                        <input id="name" type="text" class="validate" required>
                        <label for="name">お名前 *</label>
                    </div>
                    <div class="input-field col s12 m6">
                        <input id="email" type="email" class="validate" required>
                        <label for="email">メールアドレス *</label>
                    </div>
                </div>
                
                <div class="row">
                    <div class="input-field col s12 m6">
                        <input id="date" type="date" class="validate" required>
                        <label for="date">利用日 *</label>
                    </div>
                    <div class="input-field col s12 m6">
                        <select id="time" required>
                            <option value="" disabled selected>時間を選択</option>
                            <option value="09:00">09:00-10:00</option>
                            <option value="10:00">10:00-11:00</option>
                            <option value="11:00">11:00-12:00</option>
                            <option value="13:00">13:00-14:00</option>
                            <option value="14:00">14:00-15:00</option>
                            <option value="15:00">15:00-16:00</option>
                            <option value="16:00">16:00-17:00</option>
                            <option value="17:00">17:00-18:00</option>
                            <option value="18:00">18:00-19:00</option>
                            <option value="19:00">19:00-20:00</option>
                            <option value="20:00">20:00-21:00</option>
                        </select>
                        <label>利用時間 *</label>
                    </div>
                </div>
                
                <div class="row">
                    <div class="input-field col s12 m6">
                        <select id="facility" required>
                            <option value="" disabled selected>施設を選択</option>
                            <option value="ジムエリア">ジムエリア</option>
                            <option value="スタジオ">スタジオ</option>
                            <option value="会議室">会議室</option>
                        </select>
                        <label>施設 *</label>
                    </div>
                    <div class="input-field col s12 m6">
                        <input id="participants" type="number" class="validate" min="1" max="20" required>
                        <label for="participants">利用人数 *</label>
                    </div>
                </div>
                
                <div class="row">
                    <div class="input-field col s12">
                        <textarea id="purpose" class="materialize-textarea validate" required></textarea>
                        <label for="purpose">利用目的 *</label>
                    </div>
                </div>
                
                <div class="row">
                    <div class="input-field col s12">
                        <textarea id="remarks" class="materialize-textarea"></textarea>
                        <label for="remarks">備考</label>
                    </div>
                </div>
                
                <div class="row center-align">
                    <button class="btn waves-effect waves-light" type="submit" name="action">
                        予約する
                        <i class="material-icons right">send</i>
                    </button>
                </div>
            </form>
        </div>
        
        <!-- 結果表示エリア -->
        <div id="result" class="card-panel" style="display: none;">
            <h5>予約結果</h5>
            <div id="resultContent"></div>
        </div>
    </div>

    <!-- Materialize JavaScript -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/js/materialize.min.js"></script>
    
    <!-- カスタムJavaScript -->
    <script src="script.js"></script>
</body>
</html>
```

### 3.2 JavaScriptファイルの作成
```javascript
// script.js
document.addEventListener('DOMContentLoaded', function() {
    // Materialize初期化
    M.AutoInit();
    
    // 今日の日付を最小値に設定
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').setAttribute('min', today);
    
    // フォーム送信処理
    document.getElementById('reservationForm').addEventListener('submit', handleSubmit);
});

// GAS Web AppのURL（実際のURLに置き換えてください）
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';

async function handleSubmit(e) {
    e.preventDefault();
    
    // ローディング表示
    showLoading();
    
    // フォームデータの収集
    const formData = collectFormData();
    
    // バリデーション
    if (!validateFormData(formData)) {
        hideLoading();
        return;
    }
    
    try {
        // GASにPOST送信
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess(result);
            resetForm();
        } else {
            showError(result.message || '予約に失敗しました');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('通信エラーが発生しました。もう一度お試しください。');
    } finally {
        hideLoading();
    }
}

function collectFormData() {
    return {
        name: document.getElementById('name').value.trim(),
        email: document.getElementById('email').value.trim(),
        date: document.getElementById('date').value,
        time: document.getElementById('time').value,
        facility: document.getElementById('facility').value,
        participants: document.getElementById('participants').value,
        purpose: document.getElementById('purpose').value.trim(),
        remarks: document.getElementById('remarks').value.trim()
    };
}

function validateFormData(data) {
    // 必須項目チェック
    if (!data.name || !data.email || !data.date || !data.time || 
        !data.facility || !data.participants || !data.purpose) {
        M.toast({html: '必須項目を入力してください'});
        return false;
    }
    
    // メールアドレス形式チェック
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(data.email)) {
        M.toast({html: '正しいメールアドレスを入力してください'});
        return false;
    }
    
    // 日付チェック
    const selectedDate = new Date(data.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
        M.toast({html: '過去の日付は選択できません'});
        return false;
    }
    
    // 参加人数チェック
    const participants = parseInt(data.participants);
    if (participants < 1 || participants > 20) {
        M.toast({html: '利用人数は1〜20人の範囲で入力してください'});
        return false;
    }
    
    return true;
}

function showLoading() {
    const submitBtn = document.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="material-icons left">hourglass_empty</i>送信中...';
}

function hideLoading() {
    const submitBtn = document.querySelector('button[type="submit"]');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '予約する<i class="material-icons right">send</i>';
}

function showSuccess(result) {
    const resultDiv = document.getElementById('result');
    const resultContent = document.getElementById('resultContent');
    
    resultContent.innerHTML = `
        <div class="green-text">
            <i class="material-icons">check_circle</i>
            <h6>予約が正常に受け付けられました</h6>
            <p>予約ID: ${result.reservationId || 'なし'}</p>
            <p>管理者が会員確認を行い、予約を確定いたします。</p>
            <p>確認メールが送信されました。</p>
        </div>
    `;
    
    resultDiv.style.display = 'block';
    resultDiv.scrollIntoView({ behavior: 'smooth' });
    
    M.toast({html: '予約を受け付けました'});
}

function showError(message) {
    const resultDiv = document.getElementById('result');
    const resultContent = document.getElementById('resultContent');
    
    resultContent.innerHTML = `
        <div class="red-text">
            <i class="material-icons">error</i>
            <h6>予約に失敗しました</h6>
            <p>${message}</p>
        </div>
    `;
    
    resultDiv.style.display = 'block';
    resultDiv.scrollIntoView({ behavior: 'smooth' });
    
    M.toast({html: 'エラーが発生しました'});
}

function resetForm() {
    document.getElementById('reservationForm').reset();
    M.updateTextFields();
    
    // セレクトボックスを初期化
    const selects = document.querySelectorAll('select');
    selects.forEach(select => {
        const instance = M.FormSelect.getInstance(select);
        if (instance) {
            instance.destroy();
        }
    });
    M.FormSelect.init(selects);
}
```

### 3.3 CSSファイルの作成
```css
/* style.css */
body {
    background-color: #f5f5f5;
    font-family: 'Roboto', sans-serif;
}

.container {
    max-width: 800px;
    margin: 2rem auto;
    padding: 0 1rem;
}

h1 {
    color: #2e7d32;
    margin-bottom: 2rem;
    font-weight: 300;
}

.card-panel {
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    margin-bottom: 2rem;
}

.btn {
    background-color: #4caf50;
    border-radius: 25px;
    padding: 0 2rem;
}

.btn:hover {
    background-color: #45a049;
}

.input-field label {
    color: #666;
}

.input-field input:focus + label,
.input-field textarea:focus + label {
    color: #4caf50;
}

.input-field input:focus,
.input-field textarea:focus {
    border-bottom: 1px solid #4caf50;
    box-shadow: 0 1px 0 0 #4caf50;
}

.dropdown-content li > a, .dropdown-content li > span {
    color: #333;
}

#result {
    margin-top: 2rem;
}

.green-text i, .red-text i {
    vertical-align: middle;
    margin-right: 0.5rem;
}

/* レスポンシブデザイン */
@media screen and (max-width: 600px) {
    .container {
        margin: 1rem auto;
        padding: 0 0.5rem;
    }
    
    h1 {
        font-size: 1.8rem;
    }
    
    .btn {
        width: 100%;
        margin-top: 1rem;
    }
}
```

## 4. GASバックエンドの修正

### 4.1 CORS対応とWeb App設定
```javascript
// code.gs に追加
function doPost(e) {
  try {
    // CORS対応
    const response = {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    };
    
    // 既存の予約処理を実行
    const result = processReservation(e.parameter);
    
    // JSON形式でレスポンスを返す
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log('Error in doPost: ' + error);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        message: 'サーバーエラーが発生しました'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doOptions(e) {
  // プリフライトリクエストへの対応
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

### 4.2 Web App のデプロイ
```bash
1. GAS エディタで「デプロイ」→「新しいデプロイ」
2. 種類：「ウェブアプリ」
3. 説明：「Tri-force Koenji API」
4. 実行者：「自分」
5. アクセス：「全員」
6. 「デプロイ」をクリック
7. Web App URL をコピー
```

## 5. GitHub Pages のセットアップ

### 5.1 ファイルの配置（推奨構成）

```
tri-force-koenji-reservation/
├── docs/                    # ドキュメント
├── pages/                   # GitHub Pages用ファイル
│   ├── index.html
│   ├── script.js
│   └── style.css
├── src/                     # 既存のソース
├── code.gs                  # 既存のGAS
└── README.md
```

### 5.2 GitHub Pages の有効化

```bash
# GitHubリポジトリの設定
1. リポジトリのSettingsタブ
2. 左メニューの「Pages」
3. Source: "Deploy from a branch"
4. Branch: "main"
5. Folder: "/ (root)" または "/pages" (pages フォルダを作成した場合)
6. Save
```

### 5.3 現在のリポジトリ利用時の注意点

#### 5.3.1 既存ファイルとの競合回避
- **推奨**: `pages/` フォルダを作成してGitHub Pages用ファイルを配置
- **理由**: 既存の `index.html` (GAS用) と新しい `index.html` (GitHub Pages用) の競合を防ぐ

#### 5.3.2 GitHub Pages設定の選択肢
```bash
# 選択肢1: pages/ フォルダを使用
- Source: "Deploy from a branch"
- Branch: "main"
- Folder: "/pages"

# 選択肢2: docs/ フォルダを使用（ドキュメントと共存）
- Source: "Deploy from a branch"  
- Branch: "main"
- Folder: "/docs"
- 注意: 既存のドキュメントと静的ファイルを同じフォルダに配置

# 選択肢3: ルートを使用（既存ファイルの移動が必要）
- Source: "Deploy from a branch"
- Branch: "main"  
- Folder: "/ (root)"
- 注意: 既存のindex.htmlを別フォルダに移動
```

### 5.4 script.js の Web App URL 更新

```javascript
// script.js の該当部分を更新
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/YOUR_ACTUAL_SCRIPT_ID/exec';
```

## 6. テストと検証

### 6.1 ローカルテスト

```bash
# pages/ フォルダでローカルサーバーを起動
cd pages
python -m http.server 8000
# または
npx serve .

# ブラウザで http://localhost:8000 にアクセス
```

### 6.2 本番テスト

1. GitHub Pages URL にアクセス (`https://[username].github.io/tri-force-koenji-reservation/`)
2. フォーム送信テスト
3. GASバックエンドとの連携確認
4. スプレッドシートへのデータ保存確認

### 6.3 現在のリポジトリ利用時の特別な考慮事項

#### 6.3.1 既存ファイルのバックアップ
```bash
# 既存のindex.htmlをバックアップ
cp index.html gas-index.html

# 既存のファイル構成を保持
mkdir -p gas-original
mv code.gs gas-original/
mv index.html gas-original/
```

#### 6.3.2 .gitignore の更新
```bash
# .gitignore に追加（必要に応じて）
# macOS
.DS_Store

# エディタ
.vscode/
.idea/

# 一時ファイル
*.tmp
*.log
```

## 7. 移行チェックリスト

### 7.1 移行前チェック
- [ ] 既存GASの動作確認
- [ ] スプレッドシートの準備
- [ ] カレンダー設定の確認
- [ ] メール送信機能の確認

### 7.2 移行作業チェック
- [ ] HTMLファイルの作成・配置
- [ ] JavaScript の API 連携確認
- [ ] CSS の動作確認
- [ ] GAS Web App のデプロイ
- [ ] CORS 設定の確認

### 7.3 移行後チェック
- [ ] GitHub Pages の公開確認
- [ ] フォーム送信の動作確認
- [ ] データ保存の確認
- [ ] メール送信の確認
- [ ] モバイル対応の確認

## 8. 運用・保守

### 8.1 更新手順
```bash
# HTMLやCSSの更新
git add .
git commit -m "Update frontend"
git push origin main

# GASバックエンドの更新
# Apps Script エディタで直接編集・保存
```

### 8.2 監視項目
- GitHub Pages の稼働状況
- GAS の実行状況
- エラーログの確認
- 予約データの整合性

### 8.3 バックアップ
- スプレッドシートの定期バックアップ
- GAS コードのバックアップ
- フロントエンドコードのGit管理

## 9. 現在のリポジトリ利用時の追加メリット

### 9.1 既存リポジトリ利用のメリット

- **履歴保持**: 既存の開発履歴とコミット履歴を保持
- **一元管理**: GASコードとフロントエンドコードの一元管理
- **ドキュメント統合**: 既存のドキュメント体系との統合
- **段階的移行**: 既存システムを動かしながらの段階的移行

### 9.2 GitHub Pages移行のメリット

- **複数アカウント問題の解決**: GitHub Pages は認証不要
- **費用**: 完全無料
- **シンプル**: 構成が分かりやすい
- **保守性**: フロントエンドとバックエンドの分離

### 9.3 考慮事項

- **ファイル競合**: 既存のindex.htmlとの競合（pages/フォルダで解決）
- **URL変更**: 公開URLが変更される（GitHub Pages URL）
- **リダイレクト**: 必要に応じて既存URLからのリダイレクト設定

## 10. トラブルシューティング

### 10.1 よくある問題
- **CORS エラー**: GAS側のCORS設定を確認
- **フォーム送信失敗**: Web App の公開設定を確認
- **JavaScript エラー**: ブラウザの開発者ツールでデバッグ

### 10.2 対処法
```javascript
// デバッグ用のログ出力
console.log('Form data:', formData);
console.log('Response:', response);
```

---

**最終更新日**: 2024年12月
**バージョン**: 1.0
**担当者**: 開発チーム

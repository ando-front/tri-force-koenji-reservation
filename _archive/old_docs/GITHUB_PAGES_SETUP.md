# GitHub Pages セットアップ完了ガイド

## 🎯 移行状況

✅ **完了済み**
- [x] pages/ディレクトリの作成
- [x] フロントエンドファイルの作成
  - [x] pages/index.html
  - [x] pages/script.js
  - [x] pages/style.css
- [x] GASバックエンドのCORS対応
- [x] README.mdの更新
- [x] 移行手順書の整備

🔄 **次のステップ（実行が必要）**
- [ ] GAS Web Appの実際のURLを取得・設定
- [ ] GitHub Pages の有効化
- [ ] 動作テストの実施

## 🚀 次に実行すべき作業

### 1. GAS Web App URLの取得・設定

```bash
# 1. Google Apps Scriptエディタを開く
# 2. code.gs をデプロイ
# 3. 「新しいデプロイ」→「ウェブアプリ」
# 4. 設定:
#    - 実行者: 自分
#    - アクセス: 全員
# 5. 生成されたURLをコピー
```

**URLを取得したら、以下のファイルを更新:**
```javascript
// pages/script.js の 9行目
const GAS_WEB_APP_URL = '【ここに実際のURLを貼り付け】';
```

### 2. GitHub Pages の有効化

**GitHubリポジトリで実行:**
```bash
# 1. リポジトリの Settings タブを開く
# 2. 左メニューの「Pages」をクリック
# 3. 設定:
#    - Source: "Deploy from a branch"
#    - Branch: "main"
#    - Folder: "/pages"
# 4. "Save" をクリック
```

### 3. アクセス確認

**GitHub Pages URL:**
```
https://[GitHubユーザー名].github.io/tri-force-koenji-reservation/
```

## 🔧 ローカルテスト（推奨）

```bash
# pages/ディレクトリで実行
cd pages

# Python 3がインストールされている場合
python -m http.server 8000

# Node.jsがインストールされている場合
npx serve .

# ブラウザで http://localhost:8000 にアクセス
```

## 📝 動作確認項目

### フロントエンド
- [ ] ページが正しく表示される
- [ ] フォームの入力ができる
- [ ] バリデーションが動作する
- [ ] UI/UXが適切に機能する

### バックエンド連携
- [ ] フォーム送信でGASが呼び出される
- [ ] スプレッドシートにデータが保存される
- [ ] 成功/エラーメッセージが表示される
- [ ] メール送信が機能する

### レスポンシブ対応
- [ ] PC表示が適切
- [ ] スマートフォン表示が適切
- [ ] タブレット表示が適切

## 🔄 トラブルシューティング

### よくある問題と解決方法

#### 1. CORS エラー
```javascript
// code.gs に以下が含まれていることを確認
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

#### 2. GitHub Pages が表示されない
- Settings > Pages で設定が正しいか確認
- main ブランチにpages/フォルダが存在するか確認
- 数分待ってからアクセスしてみる

#### 3. フォーム送信でエラーが発生
- GAS Web App URL が正しく設定されているか確認
- GAS側でWeb Appが正しくデプロイされているか確認
- ブラウザの開発者ツールでエラーを確認

## 📞 サポート

問題が発生した場合は、以下のドキュメントを参照してください：

- [GitHub Pages移行手順書](docs/GitHub%20Pages移行手順書.md)
- [開発・運用手順書](docs/開発・運用手順書.md)
- [要件定義書](docs/要件定義書.md)

---

**最終更新:** 2024年1月
**移行ステータス:** フロントエンド完了、本番設定待ち

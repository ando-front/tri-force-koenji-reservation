# Tri-force Koenji 施設予約システム

小規模ジム（Tri-force Koenji）向けの施設予約システムです。

**MVPステータス**: ✅ 実装済み・動作確認済み

---

## 🎯 このシステムについて

会員がフィットネスルームとフリーマットを簡単に予約できるWebシステムです。

**主な機能:**
- 📅 24時間いつでも予約可能
- 🔒 認証不要（管理者が会員確認）
- 📊 自動定員管理（重複予約防止）
- 📆 Googleカレンダー連携
- 📱 モバイル対応
- 💰 完全無料で運用可能

---

## 🏗️ システム構成

```
┌─────────────┐
│  ユーザー    │ ブラウザ（PC/スマホ）
└──────┬──────┘
       │ HTTPS
       ↓
┌─────────────────────┐
│ GitHub Pages        │ フロントエンド（pages/）
│ - HTML/CSS/JS       │
└──────┬──────────────┘
       │ HTTP POST
       ↓
┌─────────────────────┐
│ Google Apps Script  │ バックエンド（code.gs）
└──────┬──────────────┘
       │
       ├─→ Google Spreadsheet（データ保存）
       └─→ Google Calendar（予約表示）
```

**技術スタック:**
- フロントエンド: HTML5, CSS3, JavaScript (Vanilla), Materialize CSS
- バックエンド: Google Apps Script
- データベース: Google Spreadsheet
- カレンダー: Google Calendar API
- ホスティング: GitHub Pages（フロントエンド）+ GAS Web App（バックエンド）

---

## 📁 プロジェクト構造

```
tri-force-koenji-reservation/
│
├── pages/                           # フロントエンド（推奨）
│   ├── index.html                  # 予約フォームUI
│   ├── script.js                   # クライアントロジック
│   └── style.css                   # スタイリング
│
├── code.gs                          # バックエンド（GAS）
├── appsscript.json                  # GAS設定
│
├── docs/                            # 実用ドキュメント
│   ├── 開発手順書.md                # セットアップ手順
│   ├── 運用手順書.md                # 管理者向け運用ガイド
│   └── GitHub Pages移行手順書.md    # デプロイ手順
│
├── MVP定義書.md                     # ✨ MVP定義と実装計画
├── 本番運用検討課題と解決案.md      # 本番運用ガイド（エンジニア向け）
├── 非技術者向け_本番運用準備ガイド.md # 本番運用ガイド（管理者向け）
├── Firebase移行手順書.md            # 将来の移行オプション
│
├── package.json                     # npm依存関係
├── .clasp.json                      # GASデプロイ設定
├── .eslintrc.json                   # コード品質設定
├── .prettierrc.json                 # フォーマッター設定
├── tsconfig.json                    # TypeScript設定（将来用）
├── rollup.config.mjs                # ビルド設定（将来用）
│
├── _archive/                        # アーカイブ（過去のファイル）
│   ├── old_frontend/               # 削除された重複フロントエンド
│   ├── old_docs/                   # 削除された過剰ドキュメント
│   ├── Code.js                     # 削除された複雑版バックエンド
│   ├── src/                        # 削除された重複ソース
│   ├── move_to_hosting/            # 削除された古い移行試行
│   └── test/                       # 削除された未実装テスト
│
└── README.md                        # このファイル
```

**削減実績:**
- コード: 1,200行 → 400行（67%削減）
- ファイル数: 40ファイル → 20ファイル（50%削減）
- ドキュメント: 21ファイル → 7ファイル（実用的なもののみ）

---

## 🚀 クイックスタート

**デプロイ方法**: GitHub Pages + GAS API

**所要時間**: 約1時間

### ステップ1: Google Apps Script セットアップ（30分）

#### 1. Google Apps Script プロジェクト作成
- https://script.google.com/ にアクセス
- 「新しいプロジェクト」をクリック
- プロジェクト名を「Tri-force Koenji 予約システム」に変更
- `code.gs` の内容をコピーして貼り付け

#### 2. Google Spreadsheet 作成
- 新しいGoogle Spreadsheetを作成
- シート名を「フォームの回答 2」に変更
- URLからスプレッドシートIDをコピー
  - 例: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`

#### 3. Google Calendar 作成
- Google Calendarで新しいカレンダーを作成
- カレンダー名: 「Tri-force Koenji 予約」
- 設定 → カレンダーの統合 → カレンダーIDをコピー

#### 4. スクリプトプロパティ設定
- GASエディタ → 「プロジェクトの設定」（歯車アイコン）
- 「スクリプトプロパティ」セクションで「プロパティを追加」
- 以下の3つを設定:

| プロパティ名 | 値 |
|-------------|---|
| `SPREADSHEET_ID` | [手順2でコピーしたID] |
| `CALENDAR_ID` | [手順3でコピーしたID] |
| `RECEPTION_URL` | （任意）予約完了後のURL |

#### 5. GAS デプロイ
- 「デプロイ」→「新しいデプロイ」
- 「種類の選択」→「ウェブアプリ」
- 設定:
  - 説明: 本番環境
  - 次のユーザーとして実行: 自分
  - アクセスできるユーザー: **全員**
- 「デプロイ」をクリック
- 生成された「ウェブアプリのURL」をコピー
  - 例: `https://script.google.com/macros/s/AKfyc.../exec`

---

### ステップ2: GitHub Pages セットアップ（30分）

#### 1. リポジトリのフォーク/クローン
```bash
# このリポジトリをフォーク後
git clone https://github.com/[あなたのユーザー名]/tri-force-koenji-reservation.git
cd tri-force-koenji-reservation
```

#### 2. GAS URL の設定
`pages/script.js` を開いて、9行目のURLを更新:

```javascript
// 手順1-5で生成されたURLに置き換え
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';
```

#### 3. 変更をコミット & プッシュ
```bash
git add pages/script.js
git commit -m "設定: GAS Web App URLを更新"
git push origin main
```

#### 4. GitHub Pages 有効化
- GitHubリポジトリのページを開く
- 「Settings」→「Pages」
- Source: `main` branch
- Folder: `/pages`（重要！）
- 「Save」をクリック

#### 5. アクセス確認
数分後、以下のURLでアクセス可能になります:
```
https://[あなたのユーザー名].github.io/tri-force-koenji-reservation/
```

---

### ステップ3: 動作確認（5分）

1. **フォームアクセス**
   - GitHub Pages のURLを開く
   - 予約フォームが表示されることを確認

2. **テスト予約**
   - 全項目を入力して送信
   - 「予約が正常に受け付けられました」が表示されることを確認

3. **データ確認**
   - Google Spreadsheetを開く
   - 新しい行にデータが追加されていることを確認
   - Google Calendarを開く
   - イベントが作成されていることを確認

---

### トラブルシューティング

#### CORSエラーが出る場合
- GASのデプロイ設定で「アクセスできるユーザー: 全員」になっているか確認
- `code.gs` を再デプロイ（「デプロイを管理」→「編集」→「バージョン: 新しいバージョン」→「デプロイ」）

#### データが保存されない場合
- スクリプトプロパティが正しく設定されているか確認
- GASのログを確認（「実行数」から確認可能）
- シート名が「フォームの回答 2」になっているか確認

#### GitHub Pagesが表示されない場合
- 設定で `/pages` フォルダを指定しているか確認
- 数分待ってから再度アクセス
- ブラウザのキャッシュをクリア

---

## 📖 ドキュメント

### 開発者向け

| ドキュメント | 説明 |
|------------|------|
| [MVP定義書.md](MVP定義書.md) | MVPの定義、実装状況、ロードマップ |
| [docs/開発手順書.md](docs/開発手順書.md) | 詳細なセットアップ手順 |
| [docs/GitHub Pages移行手順書.md](docs/GitHub%20Pages移行手順書.md) | GitHub Pages デプロイ手順 |
| [本番運用検討課題と解決案.md](本番運用検討課題と解決案.md) | 本番運用課題と技術的解決策 |
| [Firebase移行手順書.md](Firebase移行手順書.md) | 将来のFirebase移行手順 |

### 管理者向け（非エンジニア）

| ドキュメント | 説明 |
|------------|------|
| [非技術者向け_本番運用準備ガイド.md](非技術者向け_本番運用準備ガイド.md) | 平易な言葉での本番運用ガイド |
| [docs/運用手順書.md](docs/運用手順書.md) | 日常の運用作業手順 |

---

## 🔧 開発

### ローカル開発

```bash
# 依存関係インストール
npm install

# コード品質チェック
npm run lint

# 自動フォーマット
npm run lint --fix

# ローカルサーバー起動
cd pages
python -m http.server 8000
# または
npx serve .

# ブラウザで http://localhost:8000 にアクセス
```

### デプロイ

**フロントエンド（GitHub Pages）:**
```bash
git add .
git commit -m "Update frontend"
git push origin main
# GitHub Pagesに自動反映（数分かかる）
```

**バックエンド（GAS）:**
```bash
# CLASPを使用（推奨）
npm run deploy

# または GAS エディタで直接編集・保存
```

---

## ✅ 実装済み機能（MVP）

**予約機能:**
- [x] 予約フォーム（6項目入力）
- [x] メールアドレス、施設、氏名、電話、日付、時間
- [x] 施設選択（フリーマット/フィットネス）
- [x] 日付ピッカー（過去日付は選択不可）
- [x] 時間セレクター（30分刻み、7:00-21:00）

**バリデーション:**
- [x] 必須項目チェック
- [x] メールアドレス形式チェック
- [x] 過去日付の防止
- [x] 定員チェック（フリーマット: 10名、フィットネス: 4名）

**データ管理:**
- [x] Google Spreadsheet への保存
- [x] Google Calendar への自動登録
- [x] 重複予約防止
- [x] 成功/エラーメッセージ表示

**UI/UX:**
- [x] Material Design UI
- [x] モバイル対応（レスポンシブ）
- [x] 日本語インターフェース
- [x] カレンダー表示リンク

---

## 🔜 今後の拡張候補（Phase 2以降）

**セキュリティ強化:**
- [ ] reCAPTCHA v3（Bot対策）
- [ ] レート制限（スパム対策）
- [ ] Cloudflare導入（DDoS対策）

**管理機能:**
- [ ] 管理者ダッシュボード
- [ ] 予約一覧・検索・編集
- [ ] ワンクリックバックアップ
- [ ] 利用統計レポート

**ユーザー機能:**
- [ ] 予約確認メール
- [ ] 予約変更・キャンセル
- [ ] リマインダー通知
- [ ] マイページ（予約履歴）

**システム:**
- [ ] 自動バックアップ
- [ ] エラー監視・アラート
- [ ] ログ記録
- [ ] パフォーマンス最適化

詳細は [MVP定義書.md](MVP定義書.md) を参照してください。

---

## 🚨 既知の制約

| 制約 | 内容 | 影響 |
|------|------|------|
| 認証なし | 誰でも予約可能 | 管理者が予約後に会員確認 |
| 同時アクセス | ロックなし | 定員超過の可能性（低確率） |
| バックアップ | 自動化なし | 手動で週次エクスポート推奨 |
| GAS実行時間 | 最大6分 | 通常の予約処理には十分 |

詳細は [本番運用検討課題と解決案.md](本番運用検討課題と解決案.md) を参照してください。

---

## 📊 システム要件

**動作環境:**
- モダンブラウザ（Chrome, Firefox, Safari, Edge）
- JavaScript 有効
- インターネット接続

**管理者要件:**
- Googleアカウント
- Google Spreadsheet の基本操作
- Google Calendar の基本操作

**費用:**
- 完全無料（Google 無料プランで運用可能）
- Google Apps Script: 無料
- Google Spreadsheet: 無料
- Google Calendar: 無料
- GitHub Pages: 無料

---

## 🤝 貢献

プルリクエストや Issue の作成を歓迎します。

**開発の流れ:**
1. Fork このリポジトリ
2. Feature ブランチ作成 (`git checkout -b feature/amazing-feature`)
3. コミット (`git commit -m 'Add amazing feature'`)
4. プッシュ (`git push origin feature/amazing-feature`)
5. Pull Request 作成

**コーディング規約:**
- ESLint + Prettier 準拠
- 2スペースインデント
- シングルクォート
- コミットメッセージは日本語OK

---

## 📜 ライセンス

Apache License 2.0

Copyright 2023 Google LLC

---

## 📞 サポート

**技術的な質問:**
- GitHub Issues: https://github.com/[username]/tri-force-koenji-reservation/issues
- プロボノエンジニア: [連絡先]

**システム利用に関する問い合わせ:**
- 管理者: [連絡先]

---

## 🎉 謝辞

このプロジェクトは以下の技術・サービスを活用しています:
- Google Apps Script
- Google Workspace (Sheets, Calendar)
- GitHub Pages
- Materialize CSS
- Material Icons

---

**最終更新:** 2025年
**バージョン:** MVP 1.0
**ステータス:** 本番運用可能
**メンテナ:** プロボノエンジニアチーム

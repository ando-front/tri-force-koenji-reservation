# Tri-force Koenji 施設予約システム

小規模ジム（Tri-force Koenji）向けの施設予約システムです。

## 🏗️ システム構成

- **フロントエンド**: GitHub Pages (静的サイト)
- **バックエンド**: Google Apps Script (GAS)
- **データベース**: Google スプレッドシート
- **カレンダー**: Google Calendar

## 🌟 特徴

- 認証不要（管理者がスプレッドシートで会員を確認）
- 複数Googleアカウント問題の解決
- 完全無料での運用
- モバイル対応
- シンプルで使いやすいUI

## 📁 プロジェクト構成

```
tri-force-koenji-reservation/
├── docs/                    # ドキュメント
│   ├── 要件定義書.md
│   ├── 設計書.md
│   ├── 機能仕様書.md
│   ├── アーキテクチャ図.md
│   ├── 開発・運用手順書.md
│   ├── DDDモデリング.md
│   ├── AIプロンプト集.md
│   ├── GAS複数アカウント問題解決策.md
│   ├── Firebase移行手順書.md
│   ├── GitHub Pages移行手順書.md
│   ├── 品質保証・テスト戦略書.md
│   └── README_DOCS.md
├── pages/                   # GitHub Pages用ファイル
│   ├── index.html          # フロントエンド
│   ├── script.js           # クライアント処理
│   └── style.css           # スタイル
├── src/                     # 既存のソース
├── code.gs                  # GASバックエンド
├── index.html              # 既存のGAS HTML
└── README.md               # このファイル
```

## 🚀 セットアップ

### 1. GitHub Pages

予約フォームは以下のURLで公開されています：
```
https://[username].github.io/tri-force-koenji-reservation/
```

### 2. Google Apps Script

バックエンドAPIはGASで動作します：
1. `code.gs` をGASエディタに貼り付け
2. Web Appとしてデプロイ
3. 生成されたURLを `pages/script.js` に設定

### 3. Google スプレッドシート

予約データは Google スプレッドシートに保存されます：
- 予約データシート
- 会員管理シート
- 設定シート

## 📖 詳細ドキュメント

詳しい設定手順や仕様については、`docs/` フォルダ内のドキュメントを参照してください：

- [要件定義書](docs/要件定義書.md)
- [GitHub Pages移行手順書](docs/GitHub%20Pages移行手順書.md)
- [開発・運用手順書](docs/開発・運用手順書.md)

## 🔧 開発者向け

### ローカル開発

```bash
# pages/ フォルダでローカルサーバーを起動
cd pages
python -m http.server 8000
# または
npx serve .

# ブラウザで http://localhost:8000 にアクセス
```

### 更新手順

```bash
# フロントエンドの更新
git add .
git commit -m "Update frontend"
git push origin main

# バックエンドの更新
# Apps Script エディタで直接編集・保存
```

## 📜 ライセンス

Apache License 2.0

## 🤝 貢献

プルリクエストや Issue の作成を歓迎します。

## 📞 サポート

システムに関するお問い合わせは、管理者までご連絡ください。

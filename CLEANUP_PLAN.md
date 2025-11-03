# クリーンアッププラン

## 実行日時
2025年

## 目的
MVPに不要な重複ファイルと過剰なドキュメントを削除し、保守性の高いコードベースを実現する。

---

## 削除対象ファイル

### 1. 重複フロントエンド（ルートディレクトリ）

**削除:**
- ❌ `index.html` - pages/index.html と重複
- ❌ `script.js` - pages/script.js と重複

**理由:** pages/ ディレクトリ版を正式版として保持。ファイル分離されており保守性が高い。

---

### 2. 重複バックエンド

**削除:**
- ❌ `Code.js` - 高機能版だが複雑、ESLint準拠だがcode.gsで十分

**保持:**
- ✅ `code.gs` - シンプル版、GASの標準、MVPに十分

**理由:** MVPには code.gs の機能で十分。Code.js は API モードなど未使用機能が多い。

---

### 3. src/ ディレクトリ（重複）

**削除:**
- ❌ `src/code.gs` - ルートの code.gs と重複
- ❌ `src/index.html` - pages/index.html と重複
- ❌ `src/` ディレクトリ全体

**理由:** 完全に重複。ルートファイルを正式版とする。

---

### 4. move_to_hosting/ ディレクトリ（古い移行試行）

**削除:**
- ❌ `move_to_hosting/index.html`
- ❌ `move_to_hosting/script_js.js`
- ❌ `move_to_hosting/app_script.js`
- ❌ `move_to_hosting/readme.md`
- ❌ `move_to_hosting/` ディレクトリ全体

**理由:** 古い移行試行の残骸。GitHub Pages 移行は既に完了（pages/ として存在）。

---

### 5. test/ ディレクトリ（動作していないテスト）

**削除:**
- ❌ `test/main.test.gs` - 動作していない
- ❌ `test/gas-mocha-adapter.js` - 使用されていない
- ❌ `test/` ディレクトリ全体

**理由:** テストが実装されておらず、実行されていない。将来テストを書く際は新規作成。

---

### 6. 過剰なドキュメント（docs/内）

**削除対象:**
- ❌ `docs/要件定義書.md` - 67%が未実装機能、実態と乖離
- ❌ `docs/機能仕様書.md` - 未実装機能の詳細仕様、不要
- ❌ `docs/設計書.md` - 理想的な設計だが実装と乖離
- ❌ `docs/DDDモデリング.md` - DDD 適用していない
- ❌ `docs/アーキテクチャ図.md` - 詳細すぎ、MVP定義書で十分
- ❌ `docs/品質保証・テスト戦略書.md` - 理想論、実態はテストなし
- ❌ `docs/追加機能実装プロンプト集.md` - 将来機能、MVP不要
- ❌ `docs/README_DOCS.md` - 削除されるドキュメントへのインデックス

**保持:**
- ✅ `docs/開発手順書.md` - セットアップ手順として有用
- ✅ `docs/運用手順書.md` - 管理者向け運用ガイドとして有用
- ✅ `docs/GitHub Pages移行手順書.md` - デプロイ手順として有用

**理由:** 実装されていない機能のドキュメントは混乱を招く。MVP に必要な実用ドキュメントのみ保持。

---

### 7. 重複ドキュメント（ルート）

**削除対象:**
- ❌ `DDDモデリング.md` - docs/DDDモデリング.md と重複、かつ未適用
- ❌ `追加機能実装プロンプト集.md` - docs/追加機能実装プロンプト集.md と重複
- ❌ `GAS複数アカウント問題解決策.md` - 既に解決済み、歴史的資料
- ❌ `GITHUB_PAGES_SETUP.md` - docs/GitHub Pages移行手順書.md で十分

**保持:**
- ✅ `Firebase移行手順書.md` - 将来の移行オプションとして保持
- ✅ `本番運用検討課題と解決案.md` - 本番運用の重要資料
- ✅ `非技術者向け_本番運用準備ガイド.md` - 管理者向け重要資料
- ✅ `MVP定義書.md` - プロジェクトの核となるドキュメント

**理由:** 実用的で現在有効なドキュメントのみ保持。

---

## 保持ファイル（MVPに必要）

### フロントエンド
```
pages/
├── index.html      ✅ 予約フォームUI
├── script.js       ✅ クライアントロジック
└── style.css       ✅ スタイリング
```

### バックエンド
```
code.gs             ✅ GASバックエンド（簡易版）
appsscript.json     ✅ GAS設定
```

### 設定・ビルド
```
package.json        ✅ npm依存関係
.clasp.json         ✅ GASデプロイ設定
.editorconfig       ✅ エディタ設定
.eslintrc.json      ✅ コード品質
.prettierrc.json    ✅ フォーマッター
tsconfig.json       ✅ TypeScript設定（将来用）
rollup.config.mjs   ✅ ビルド設定（将来用）
```

### ドキュメント
```
README.md                              ✅ メインREADME
MVP定義書.md                           ✅ MVP定義
本番運用検討課題と解決案.md              ✅ 本番運用ガイド
非技術者向け_本番運用準備ガイド.md       ✅ 管理者ガイド
Firebase移行手順書.md                  ✅ 将来の移行オプション

docs/
├── 開発手順書.md                      ✅ セットアップ手順
├── 運用手順書.md                      ✅ 運用ガイド
└── GitHub Pages移行手順書.md          ✅ デプロイ手順
```

### その他
```
LICENSE             ✅ Apache 2.0
.gitignore          ✅ Git設定
```

---

## アーカイブ対象

削除するファイルのうち、将来参照する可能性があるものをアーカイブディレクトリに移動：

```
_archive/
├── old_frontend/
│   ├── index.html
│   └── script.js
├── Code.js
├── src/
├── move_to_hosting/
├── test/
└── old_docs/
    ├── 要件定義書.md
    ├── 機能仕様書.md
    ├── 設計書.md
    ├── DDDモデリング.md
    ├── アーキテクチャ図.md
    ├── 品質保証・テスト戦略書.md
    └── 追加機能実装プロンプト集.md
```

---

## 削減効果

### コード
- **現状:** 約1,200行（重複含む）
- **削減後:** 約400行
- **削減率:** 67%

### ファイル数
- **現状:** 約40ファイル（コード+ドキュメント）
- **削減後:** 約20ファイル
- **削減率:** 50%

### ドキュメント
- **現状:** 21ファイル
- **削減後:** 7ファイル（実用的なもののみ）
- **削減率:** 67%

---

## 実行順序

1. ✅ アーカイブディレクトリ作成
2. ✅ 削除対象ファイルをアーカイブに移動
3. ✅ Git commit（アーカイブ）
4. ✅ README.md を更新（新しいディレクトリ構造を反映）
5. ✅ Git commit（クリーンアップ完了）

---

## 実行コマンド

```bash
# 1. アーカイブディレクトリ作成
mkdir _archive
mkdir _archive/old_frontend
mkdir _archive/old_docs

# 2. フロントエンド重複を移動
mv index.html _archive/old_frontend/
mv script.js _archive/old_frontend/

# 3. バックエンド重複を移動
mv Code.js _archive/

# 4. ディレクトリを移動
mv src/ _archive/
mv move_to_hosting/ _archive/
mv test/ _archive/

# 5. ドキュメントを移動
mv docs/要件定義書.md _archive/old_docs/
mv docs/機能仕様書.md _archive/old_docs/
mv docs/設計書.md _archive/old_docs/
mv docs/DDDモデリング.md _archive/old_docs/
mv docs/アーキテクチャ図.md _archive/old_docs/
mv docs/品質保証・テスト戦略書.md _archive/old_docs/
mv docs/追加機能実装プロンプト集.md _archive/old_docs/
mv docs/README_DOCS.md _archive/old_docs/

# 6. ルートの重複ドキュメントを移動
mv DDDモデリング.md _archive/old_docs/
mv 追加機能実装プロンプト集.md _archive/old_docs/
mv GAS複数アカウント問題解決策.md _archive/old_docs/
mv GITHUB_PAGES_SETUP.md _archive/old_docs/

# 7. Git commit
git add -A
git commit -m "chore: アーカイブへ移動 - MVPに不要なファイルを整理"
```

---

## 注意事項

- **削除ではなくアーカイブ:** 完全削除ではなく `_archive/` に移動。必要に応じて参照可能。
- **Git 履歴は保持:** ファイルの歴史は Git 履歴に残る。
- **段階的実施:** 一度に全て実施せず、動作確認しながら進める。
- **.gitignore 確認:** `_archive/` をコミットするか、.gitignore に追加するか決定。

---

## 実施後の確認

- [ ] pages/ のフロントエンドが動作する
- [ ] code.gs のバックエンドが動作する
- [ ] README.md が新しい構造を反映している
- [ ] 保持したドキュメントが正しく機能する
- [ ] Git 履歴が正常

---

## ロールバック方法

問題があった場合：
```bash
# 最新のコミットを取り消し
git reset --hard HEAD~1

# または、アーカイブから復元
cp _archive/old_frontend/index.html .
cp _archive/Code.js .
# など
```

---

**作成日:** 2025年
**実施予定日:** 2025年（今日）
**所要時間:** 30分

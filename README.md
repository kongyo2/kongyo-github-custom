# Kongyo GitHub Custom

GitHub のリポジトリページに **DeepWiki** / **Code Wiki** / **Repomix** へのショートカットボタンを追加する Chrome 拡張機能です。

[yamadashy/repomix](https://github.com/yamadashy/repomix) のブラウザ拡張機能部分、[yamadashy/github-deepwiki-button](https://github.com/yamadashy/github-deepwiki-button)、[yamadashy/github-code-wiki-button](https://github.com/yamadashy/github-code-wiki-button) の 3 つを 1 つの拡張機能に統合・参考にさせて頂いています。素晴らしい OSS を公開してくださっている [@yamadashy](https://github.com/yamadashy) さんに感謝します。

## 特徴

- **3 つのサービスを 1 つの拡張機能に統合**
  - [DeepWiki](https://deepwiki.com/) — リポジトリから AI が生成した対話型ドキュメント
  - [Code Wiki](https://codewiki.google/) — Google の Code Wiki によるコード解説
  - [Repomix](https://repomix.com/) — リポジトリを LLM 向けに 1 ファイルへパッケージング
- リポジトリページの操作バー横にボタンを差し込み、ワンクリックで各サービスを開きます
- オプションページから次の項目をカスタマイズ可能
  - 表示する/しないボタンの切り替え
  - 表示スタイル（アイコンのみ / アイコン+テキスト など）
  - グルーピング（個別表示 / まとめて表示）
  - 並び順（ドラッグで変更）
  - 新しいタブで開くかどうか
  - DeepWiki のページ存在チェックの有効/無効
- 任意の URL テンプレートを使った **カスタムサービス** の追加にも対応
- 設定は `chrome.storage.sync` に保存されるので、Chrome にログインしている端末間で同期されます
- 多言語対応（英語 / 日本語）

## インストール

### Chrome ウェブストアから（推奨）

準備中です。

### 開発版をローカルから読み込む

```bash
npm install
npm run build
```

ビルドが完了すると `dist/` ディレクトリが生成されます。

1. Chrome で `chrome://extensions` を開く
2. 右上の **デベロッパーモード** をオンにする
3. **パッケージ化されていない拡張機能を読み込む** をクリックし、`dist/` ディレクトリを選択する

## 使い方

1. 拡張機能をインストールした状態で、任意の GitHub リポジトリページ（例: `https://github.com/owner/repo`）を開きます
2. リポジトリ名横の操作バーに DeepWiki / Code Wiki / Repomix のボタンが追加されます
3. ボタンをクリックすると、対応するサービスの該当リポジトリのページが開きます

設定を変更するには、拡張機能アイコンを右クリック →「オプション」、もしくは `chrome://extensions` から **詳細 → 拡張機能のオプション** を開いてください。

## 開発

```bash
# 開発サーバー（HMR 付き）
npm run dev

# 型チェック
npm run typecheck

# Lint / フォーマット
npm run lint
npm run format

# プロダクションビルド
npm run build

# 配布用 zip を生成
npm run package
```

### 主要な技術スタック

- [Vite](https://vitejs.dev/) + [@crxjs/vite-plugin](https://github.com/crxjs/chrome-extension-tools)
- TypeScript / React 18
- [Zod](https://zod.dev/) によるスキーマバリデーション
- Manifest V3

### ディレクトリ構成

```
src/
├── background/   # サービスワーカー（存在チェックなど）
├── content/      # GitHub ページにボタンを差し込むコンテンツスクリプト
├── lib/          # 設定スキーマ、組み込み/カスタムサービス定義
├── options/      # オプションページ（React）
└── manifest.ts   # 拡張機能のマニフェスト定義
```

## クレジット

本拡張機能は、[@yamadashy](https://github.com/yamadashy) さんが公開されている以下のプロジェクトを統合・参考にさせて頂いています。

- [yamadashy/repomix](https://github.com/yamadashy/repomix) — Repomix 本体およびブラウザ拡張機能部分
- [yamadashy/github-deepwiki-button](https://github.com/yamadashy/github-deepwiki-button) — GitHub に DeepWiki ボタンを追加する拡張機能
- [yamadashy/github-code-wiki-button](https://github.com/yamadashy/github-code-wiki-button) — GitHub に Code Wiki ボタンを追加する拡張機能

それぞれのアイデアと実装に深く感謝いたします。

## ライセンス

[MIT License](./LICENSE)

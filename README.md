# DDR Option Memo — prototype v0.1

DDR SP EXPERT / CHALLENGE 譜面のオプションを素早く確認するAndroid向けWebアプリの試作です。**KONAMI非公式**。

## 起動

Node.js 20.19+ または 22+ を使用してください。

```bash
npm install
npm run dev
```

ターミナルに表示されるURLを開いてください。ビルドは `npm run build`。

## 操作

- 上部のLvでレベルを切り替えます。EX+CH / EX / CHで譜面を絞り込みます。
- ジャケットをタップすると枠線が付き、上部で「－ / 正 / 鏡 / 右 / 左 / 乱」を編集できます。
- 判定は整数msで、空欄は未設定、0は設定済み0msです。
- メモボタンでポップアップを開きます。
- 設定はブラウザのlocalStorageに自動保存します。ブラウザのデータ消去で消えるため、右上のダウンロードボタンでバックアップしてください。下部から復元できます。

## 楽曲データ

`public/data/songs.json` は**架空のデモデータ**です。公式楽曲の完全取得は未実装です。右上のアップロードボタンで独自JSONを一時的に読み込めます（リロードすると同梱JSONに戻ります）。JSON例：

```json
[
  {
    "id": "stable-song-id",
    "title": "曲名",
    "sortKey": "曲名順用のキー",
    "jacketUrl": "https://example.com/jacket.jpg",
    "charts": [
      {"difficulty":"expert","level":16},
      {"difficulty":"challenge","level":17}
    ]
  }
]
```

`id` は楽曲ごとに一意で、楽曲更新後も変わらない値を使ってください。設定キーは `id:sp:expert` / `id:sp:challenge` です。画像URLはHTTPSのみ許容します。

## GitHub Pages

リポジトリにファイルを配置し、Settings → Pages → Build and deployment → Source を **GitHub Actions** に設定してください。mainへのpushでビルド・公開します。公開リポジトリに個人メモのバックアップをコミットしないでください。

## 未実装

- 公式DDR WORLDページの全ページ取得・パーサー・差分検証・定期同期（公開HTMLの実構造とアクセス条件を検証してから実装）
- Firebase認証・クラウド同期
- オフラインキャッシュ用Service Worker / インストールアイコン（manifestは雛形のみ。現時点では完全なPWAではありません）
- 実ジャケット表示のAndroid端末検証

楽曲一覧の参照元候補: https://p.eagate.573.jp/game/ddr/ddrworld/music/index.html?filter=7&offset=0

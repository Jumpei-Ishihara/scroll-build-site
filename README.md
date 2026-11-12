# scroll-build-site

スクロールに合わせて Web サイトが組み上がっていく演出のデモ。現在は開発用の土台だけがあり、演出は未実装(案 C / 案 D+E は未決定)。

## 構成

| パス | 内容 |
|---|---|
| `index.html` | ページ本体。ステージ(演出用)と完成サイト(仮)を持つ |
| `src/core.js` | スクロール位置から進行度 0〜1 を求め、`window.SB` として公開する |
| `src/base.css` | 土台のスタイル |
| `libs/` | GSAP 3.15.1(gsap、ScrollTrigger、Flip)。同梱しているのでインストール不要 |
| `tests/` | ブラウザ上で実行するテスト。`phase<番号>.js` と一括実行の `run-all.js` |
| `specs/` | 要件(SPEC-00 共通、SPEC-01 案 C、SPEC-02 案 D+E)、SPEC-10 技術選定、SPEC-11 詳細設計、SPEC-20 デザイン設計 |
| `src/styles/tokens.css` | 色、文字、余白、動きの値 |
| `design/styleguide.html` | デザインの確認用ページ。`http://localhost:8742/design/styleguide.html` |
| `企画書.md` | 調査結果と企画候補 |

ビルド工程はない。静的ファイルをそのまま配信する。

## 開発サーバー

```bash
python3 -m http.server 8742
```

`http://localhost:8742/` を開く。Claude Code からは `.claude/launch.json` の `scroll-build-site` で起動できる。

## テスト

ページを開いた状態で、ブラウザのコンソールから実行する。

```js
fetch('tests/run-all.js').then(r => r.text()).then(eval)
```

結果は `window.__ALLRESULTS` に入る。フェーズごとの結果は `window.__P<番号>RESULTS`。

## 進行度の API

| API | 内容 |
|---|---|
| `SB.progress` | 現在の進行度(0〜1) |
| `SB.onProgress(fn)` | 進行度が変わるたびに `fn(progress)` を呼ぶ。演出はここに登録する |
| `SB.setProgress(p)` | テスト用。進行度 `p` の位置へスクロールし、反映後の進行度を返す |
| `SB.reduced` | 「動きを減らす」設定が有効なら `true`。このとき進行度は常に 1 |

## 進め方

要件 → テストを先に書く → 実装 → `run-all.js` が全部通ることを確認、の順でフェーズごとに進める。

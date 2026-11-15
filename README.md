# scroll-build-site

スクロールに合わせて Web サイトが組み上がっていく演出のデモ。
セクションが画面に来るとページの動きが止まり、スクロールに合わせて小人たちがそのセクションを組み立てる。組み上がると次のセクションへ進む(SPEC-03)。

## 見かた

```bash
python3 -m http.server 8742
```

`http://localhost:8742/` を開いてスクロールする。Claude Code からは `.claude/launch.json` の `scroll-build-site` で起動できる。

| URL | 内容 |
|---|---|
| `/` | 本体 |
| `/?motion=reduce` | 「動きを減らす」設定のときの表示(演出なしで完成サイト)を確認する |
| `/design/styleguide.html` | 配色、書体、部品の見本 |

## 構成

| パス | 内容 |
|---|---|
| `index.html` | 完成サイトの HTML と、小人・案内・進行表示の置き場 |
| `src/main.js` | 起動 |
| `src/core/scroll.js` | スクロール位置から状態を求めて描画する。固定と移動の切り替え、スキップ、やり直し |
| `src/c/timeline.js` | 場面(固定の単位)、工程、手順のデータ |
| `src/c/state.js` | スクロール位置から状態を計算する `stateAt`。副作用なし |
| `src/c/render.js` | 状態を画面に反映する |
| `src/c/measure.js` | 要素の位置と大きさの計測、場面ごとの固定位置の計算、見出しの 1 文字ずつの分割 |
| `src/c/kobito.js` | 小人の絵と、コマの切り替え |
| `src/styles/` | `tokens.css`(色や文字の値)、`site.css`(完成サイト)、`ui.css`(固定、小人、案内、進行表示)、`build.css`(組み立て途中の見た目) |
| `tests/` | ブラウザ上で実行するテスト |
| `specs/` | 要件、技術選定、詳細設計、デザイン設計 |
| `企画書.md` | 調査結果と企画候補 |

ビルド工程も外部ライブラリもない。静的ファイルをそのまま配信する。

## テスト

ページを開いた状態で、ブラウザのコンソールから実行する。

```js
fetch('tests/run-all.js').then(r => r.text()).then(eval)
```

結果は `window.__ALLRESULTS`。フェーズごとの結果は `window.__P<番号>RESULTS`。

| ファイル | 対象 | 件数 |
|---|---|---|
| `phase5.js` | 固定と移動、組み立ての順序、スキップ、やり直し、ページ内リンク | 27 |
| `phase6.js` | 小人、スマホ幅、動きを減らす設定、幅の変更、再読み込み、性能の目安 | 28 |

## 調整する場所

| 変えたいこと | 場所 |
|---|---|
| 場面の区切り、場面に含める要素 | `src/c/timeline.js` の `SCENES` |
| 1 場面あたりの固定の長さ | `src/c/timeline.js` の `HOLD`(画面の高さの 1.4 倍) |
| 工程の配分(骨組み、文字、色、仕上げ) | `src/c/timeline.js` の `SUBS` |
| 色、書体、動きの速さ | `src/styles/tokens.css` |
| 組み立て途中の見た目(灰色の箱など) | `src/styles/build.css` |

## `window.SB`

| API | 内容 |
|---|---|
| `SB.progress` / `SB.state` / `SB.mode` | 現在の進行度、状態、モード(`static` / `build` / `done`) |
| `SB.stateAt(p)` | スクロールせずに、進行度 `p` の状態を計算する |
| `SB.setScene(k, q)` | テスト用。場面 `k` の進み具合 `q` の位置へ移動し、補間を終わらせてから返す |
| `SB.setProgress(p)` | テスト用。進行度 `p` の位置へ移動する |
| `SB.m` | 計測値。`SB.m.scenes` に場面ごとの固定位置が入る |

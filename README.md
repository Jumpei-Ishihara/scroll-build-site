# scroll-build-site

スクロールに合わせて Web サイトが組み上がっていく演出のデモ(案 C「カーソルの中の人」)。
デザインツール風の画面で、カーソルにぶら下がった小人たちがページを組み立て、最後に「公開」されて普通のサイトになる。

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
| `index.html` | 完成サイトとツール UI の HTML |
| `src/main.js` | 起動 |
| `src/core/` | 進行度の計算(`progress.js`)、段階の定義(`stages.js`)、補助関数 |
| `src/c/timeline.js` | 手順のデータ(誰が、どの段階で、どの要素に、何をするか) |
| `src/c/state.js` | 進行度から状態を計算する `stateAt`。副作用なし |
| `src/c/render.js` | 状態を画面に反映する |
| `src/c/measure.js` | 要素の位置と大きさの計測、見出しの 1 文字ずつの分割 |
| `src/c/kobito.js` | 小人の絵と、コマの切り替え |
| `src/styles/` | `tokens.css`(色や文字の値)、`site.css`(完成サイト)、`tool.css`(ツール UI と小人)、`build.css`(演出中だけ有効な指定) |
| `libs/` | GSAP 3.15.1。使っているのは gsap と ScrollTrigger |
| `tests/` | ブラウザ上で実行するテスト |
| `specs/` | 要件、技術選定、詳細設計、デザイン設計 |
| `企画書.md` | 調査結果と企画候補 |

ビルド工程はない。静的ファイルをそのまま配信する。

## テスト

ページを開いた状態で、ブラウザのコンソールから実行する。

```js
fetch('tests/run-all.js').then(r => r.text()).then(eval)
```

結果は `window.__ALLRESULTS`。フェーズごとの結果は `window.__P<番号>RESULTS`。

| ファイル | 対象 | 件数 |
|---|---|---|
| `phase1.js` | 骨格、モード、スキップ、完成サイトとの一致 | 25 |
| `phase2.js` | 段階 2〜4、レイヤー、プロパティ、選択枠、カーソル | 15 |
| `phase3.js` | 小人 | 9 |
| `phase4.js` | スマホ幅、動きを減らす設定、幅の変更、再読み込み、性能の目安 | 18 |

## 調整する場所

| 変えたいこと | 場所 |
|---|---|
| 段階の長さ | `src/core/stages.js` の `STAGES` |
| 手順の順番、担当カーソル、小人の見せ場 | `src/c/timeline.js` |
| 演出全体のスクロール量 | `src/core/progress.js` の `end`(画面 5 枚分) |
| 色、書体、動きの速さ | `src/styles/tokens.css` |
| 途中の見た目(灰色の箱など) | `src/styles/build.css`。色を変えたら `src/c/state.js` の定数も合わせる |

## `window.SB`

| API | 内容 |
|---|---|
| `SB.progress` / `SB.state` / `SB.mode` | 現在の進行度、状態、モード(`static` / `build` / `done`) |
| `SB.stateAt(p)` | スクロールせずに、進行度 `p` の状態を計算する |
| `SB.setProgress(p)` | テスト用。進行度 `p` の位置へ移動し、補間を終わらせてから返す |
| `SB.onProgress(fn)` | 進行度が変わるたびに呼ばれる関数を登録する |

# scroll-build-site

Web サイトが目の前で組み上がっていく演出のデモ。
ページを開くと、小人たちが最初のセクションを約 3 秒で組み立てる。1 回スクロールすると次のセクションへ移動し、また組み立てが始まる。組み立てが終わるまでページは固定される(SPEC-05)。
小人はまず枠を用意し、文字やパーツを画面の外から運んできて枠の中に置く(SPEC-04)。全部組み上がると、通常のページになる。

## 見かた

```bash
python3 -m http.server 8742
```

`http://localhost:8742/` を開く。Claude Code からは `.claude/launch.json` の `scroll-build-site` で起動できる。

| URL | 内容 |
|---|---|
| `/` | 本体 |
| `/?motion=reduce` | 「動きを減らす」設定のときの表示(演出なしで完成サイト)を確認する |
| `/design/styleguide.html` | 配色、書体、部品の見本 |

## 構成

| パス | 内容 |
|---|---|
| `index.html` | 完成サイトの HTML と、小人・進行表示の置き場 |
| `src/main.js` | 起動 |
| `src/core/scroll.js` | 進行の管理。時間で組み立てを進め、スクロールやキーの入力で次の場面へ移動する。スキップ、やり直し |
| `src/c/timeline.js` | 場面(固定の単位)、工程、手順のデータ |
| `src/c/state.js` | 場面ごとの進み具合から状態を計算する `compose`。副作用なし |
| `src/c/render.js` | 状態を画面に反映する |
| `src/c/measure.js` | 要素とパーツ(`data-part`)の位置と大きさの計測、場面ごとの固定位置の計算 |
| `src/c/kobito.js` | 小人の絵と、コマの切り替え |
| `src/styles/` | `tokens.css`(色や文字の値)、`site.css`(完成サイト)、`ui.css`(固定、小人、進行表示)、`build.css`(組み立て途中の見た目) |
| `tests/` | ブラウザ上で実行するテスト |
| `specs/` | 要件、技術選定、詳細設計、デザイン設計 |
| `企画書.md` | 調査結果と企画候補 |

ビルド工程も外部ライブラリもない。静的ファイルをそのまま配信する。

## テスト

ページを開いた状態で、ブラウザのコンソールから実行する。

```js
fetch('tests/run-all.js').then(r => r.text()).then(eval)
```

実際の時間で動かすテストがあるので、終わるまで 1 分ほどかかる。結果は `window.__ALLRESULTS`。フェーズごとの結果は `window.__P<番号>RESULTS`。

| ファイル | 対象 | 件数 |
|---|---|---|
| `phase5.js` | 場面の表示位置、組み立ての順序、操作できる範囲 | 16 |
| `phase6.js` | 小人(人数と速さを含む)、スマホ幅、動きを減らす設定、幅の変更、再読み込み、性能の目安 | 31 |
| `phase7.js` | 小人がパーツを運ぶ演出 | 22 |
| `phase8.js` | 時間で進む組み立て、スクロール・キー・スワイプでの移動、スキップ、やり直し、ページ内リンク | 28 |

人数ごとの小人の速さは `tests/crew-speed.js` で測れる(SPEC-06)。同じように読み込むと、結果が `window.__CREW` に入る。

## 調整する場所

| 変えたいこと | 場所 |
|---|---|
| 場面の区切り、場面に含める要素 | `src/c/timeline.js` の `SCENES` |
| 1 場面の組み立てにかける時間 | `src/c/timeline.js` の `BUILD_MS`(3200 ミリ秒) |
| 小人の人数 | `src/c/timeline.js` の `CREW`(デスクトップもスマホも 8 人)。URL に `?crew=4` のように付けると、その人数で試せる |
| 場面の間の移動にかける時間 | `src/c/timeline.js` の `MOVE_MS`(700 ミリ秒) |
| 工程の配分(骨組み、文字とパーツ、色、仕上げ) | `src/c/timeline.js` の `SUBS` |
| 小人が 1 回で運ぶ単位 | `index.html` の `data-part` |
| 色、書体、動きの速さ | `src/styles/tokens.css` |
| 組み立て途中の見た目(灰色の箱など) | `src/styles/build.css` |

## `window.SB`

| API | 内容 |
|---|---|
| `SB.progress` / `SB.state` / `SB.mode` | 現在の進行度、状態、モード(`static` / `build` / `done`) |
| `SB.stateAt(p)` | 進行度 `p` の状態を計算する |
| `SB.phase` / `SB.scene` / `SB.built` | 段階(`idle` / `move` / `build`)、今いる場面、組み上がった場面の数 |
| `SB.next()` / `SB.prev()` / `SB.go(k)` | 次、前、場面 `k` へ移動する |
| `SB.setScene(k, q)` | テスト用。アニメーションを止め、場面 `k` の進み具合 `q` の状態にする |
| `SB.setProgress(p)` | テスト用。アニメーションを止め、進行度 `p` の状態にする |
| `SB.crew` / `SB.timeline` | 小人の人数、場面ごとの手順 |
| `SB.m` | 計測値。`SB.m.scenes` に場面ごとの固定位置が入る |

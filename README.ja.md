# Jev Playground

[English](README.md)

TypeSafe の System One モデル **Jev** を試すための、1 画面のプレイグラウンドです。Jev は `state`（評価対象）と型付きの `questions`（質問）を受け取り、コードがそのまま使える構造化された回答（選択・スコア・確率）を返します。「どんな API なのか」「どんな JSON を送るのか」「何が返ってくるのか」をひと目で把握できるようにすることが目的です。

非公式のデモです。正確な仕様は [TypeSafe のドキュメント](https://docs.typesafe.ai/introduction) を参照してください。

## 画面構成

| 場所 | 内容 |
| --- | --- |
| 左・上 | リクエストボディ（JSON）をそのまま編集できる入力欄、動作するサンプルのドロップダウン、選択中のサンプルの説明（想定用途・指定しているもの・返ってくるもの・コード側での使い方）を開く「解説」ボタン |
| 左・下 | 結果。回答ごとのカード（値、確率バー、confidence、`response.answers.department.choice` のようなアクセスパス）と、レスポンスの生 JSON |
| 右 | エンドポイントとヘッダ、直近の呼び出しのステータス・所要時間・トークン数、入力欄に連動する送信コード（curl / fetch / JS SDK / Python SDK / このデモ自身のコード）、リクエストとレスポンスの形の早見表、エラーコード、モデルと料金の情報 |
| ヘッダ | 表示言語の切り替え、API キーの設定、ページを開いてからの利用量（リクエスト数、input / output トークン数、推定コスト） |

画面は日本語と英語に対応しています。初回はブラウザの言語に従い、ヘッダのボタンでいつでも切り替えられます（選択はそのブラウザに記憶されます）。サンプルのリクエストボディは翻訳されません。

## 起動方法

Node.js 20 以上が必要です。依存パッケージもビルドもありません。

```sh
node server.js          # PORT の既定値は 8787
```

<http://localhost:8787> を開き、ヘッダの「⚙ API キーを設定」から <https://console.typesafe.ai/keys> で発行したキーを入力します。サンプルを選んで「送信」（または Cmd/Ctrl + Enter）を押してください。

## API の概要

```http
POST https://api.typesafe.ai/v1/systemone
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

```json
{
  "state": "Help! My payouts have been failing for 3 days.",
  "model": "jev-latest",
  "questions": {
    "department": {
      "type": "choice",
      "instructions": "Which team should handle this?",
      "criteria": { "billing": "Payments, refunds", "technical": "Bugs, outages" }
    },
    "frustration": {
      "type": "score",
      "instructions": "How frustrated is the customer?",
      "criteria": ["Calm", "Frustrated", "Very angry"]
    },
    "is_urgent": { "type": "noul", "instructions": "Does this convey urgency?" }
  }
}
```

- `state` は評価対象です。文字列・オブジェクト・配列のいずれかを渡します。
- `questions` はキー名を自分で決めるマップで、回答は同じキーの下に返ります。すべての質問は同じ state に対して並列かつ独立に評価されます。
- 質問タイプは 3 種類です。`choice`（選択肢から 1 つ選ぶ。`criteria` は「選択肢: 説明または `null`」のマップ）、`score`（順序のある段階で採点する。`criteria` は配列）、`noul`（「はい」である確率を返す。`criteria` は任意）。
- Choice と Score の回答には `probabilities` と `confidence` が付きます。すべてのレスポンスに `usage`（`input_tokens` / `output_tokens`）が含まれます。
- `GET /v1/models` で、アカウントで使えるモデル名の一覧を取得できます。

## API キーの扱い

- キーはページ上で入力し、そのブラウザの `localStorage` にだけ保存されます。画面には末尾 4 文字だけを伏字付きで表示します。
- 呼び出しのたびに `Authorization` ヘッダとしてこのデモのプロキシへ送られ、プロキシはそのヘッダをそのまま TypeSafe に転送します。
- `server.js` は自分のキーを持たず、ヘッダの保存もログ出力もしません。サーバ側のキー設定や環境変数はありません。

## プロキシがある理由

`api.typesafe.ai` はブラウザからの呼び出しを拒否します（CORS のプリフライトに `Disallowed CORS origin` を返します）。そのため静的なページから直接は呼べません。`server.js` は `index.html` を配信し、次の 2 つの経路を中継します。401 / 422 / 429 / 529 の応答がそのまま見えるよう、上流のステータスとボディは加工せずに返します。

| デモの経路 | 転送先 |
| --- | --- |
| `POST /api/systemone` | `POST https://api.typesafe.ai/v1/systemone` |
| `GET /api/models` | `GET https://api.typesafe.ai/v1/models` |

## コスト表示について

TypeSafe のドキュメントにはコストや請求を取得する API がありません。ヘッダのコストはページ内で計算した推定値で、各レスポンスの `usage.input_tokens` の合計 × 100 万トークンあたり $0.042（jev-1.13 の公開単価。output トークンは無料）です。単価は `index.html` の定数 `PRICE_PER_MTOK_USD` にあるので、料金が変わったら更新してください。集計はページを再読み込みするとリセットされます。

## 公開するとき

- Node を動かせる環境（Render、Fly.io、Railway、VPS など）が必要です。プロキシが必須のため、GitHub Pages のような静的ホスティングでは動きません。
- サーバは環境変数 `PORT` のポートで、すべてのインターフェースで待ち受けます。多くの PaaS でそのまま動く設定です。
- **HTTPS** で公開してください。訪問者の API キーがブラウザからサーバまで送られるためです。
- このサーバは、転送先を TypeSafe の API に固定した、誰でも使える中継です。訪問者は自分のキーを使うので TypeSafe への支払いは発生せず、負担は計算資源と通信量だけです。レート制限やアクセス制御は入っていないので、必要なら追加してください。
- 訪問者に API キーを入力してもらうデモなので、プロキシの中身を確認できるようソースコードへのリンクを置くことを検討してください。

## サンプル

サポートチケット（3 タイプを 1 回で）、criteria 付きの Noul、説明が `null` の Choice、Score、構造化した `state`、構造化した `instructions`、日本語テキスト、意図的に不正なリクエスト（422 の確認用）の 8 つです。TypeSafe のドキュメントの例そのままのものと、このデモ用に作成したものがあり、どちらなのかは「解説」モーダルの出典欄に書いてあります。サンプルは `index.html` の `SAMPLES` 配列にあります。

まだ入っていないもの: 配列の `state`、構造化した `criteria`、ドキュメントにある複数ステップのパターンやクックブック（fan-out、confidence による振り分け、複合スコアリング、再ランキング、ガードレールなど）。

## ファイル

- `index.html` — プレイグラウンド本体（マークアップ・スタイル・スクリプト）
- `server.js` — 静的ファイルの配信と API プロキシ

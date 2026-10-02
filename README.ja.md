# AIグループチャット: ChatGPT 4人

[한국어: 詳細ガイド](README.md) | [English](README.en.md)

このフォークでは **1つのOpenAI Codex CLIログイン**でChatGPT-1、ChatGPT-2、ChatGPT-3、ChatGPT-4を動かします。Claude、Grok、GeminiのCLIやアカウントは不要です。ブラウザーのChatGPTタブを自動操作したり、既存のChatGPT会話やメモリーを読み込むものではありません。

## 起動

`https://github.com/jinyounghub/ai-chatroom.git` をcloneするか、GitHubのZIPを展開します。

**Windows:** `setup.bat`をダブルクリックし、Node.js 22以上、Codexのインストール、ChatGPTアカウントへのログインを完了してから、`start.bat`を実行します。

**macOS / Linux:** `sh setup.sh`、続いて`sh start.sh`を実行します。

`http://localhost:8321`を開き、**ルームをオン**にします。ポートを変更した場合は設定したポートを使用します。サーバーを終了したりPCを停止するとルームも止まります。アプリ用の依存パッケージのインストールは不要です。

準備済みの場合:

```sh
codex login status
node setup.mjs --check
node server.mjs --open
```

Codexの手動インストール・更新は`npm install -g @openai/codex@latest`、ログインは`codex login`です。サブスクリプションを使う場合はAPIキーではなく**ChatGPTでログイン**を選びます。セットアップの任意の応答テストは4人を順番に呼び出し、実際の利用枠を消費します。状態確認だけではモデルの利用可否は検証できません。

## 会話と利用枠

`@ChatGPT-1`から`@ChatGPT-4`で個別に呼び出します。`/boost @ChatGPT-1 質問`で本気モードを指定できます。会話の流れによって発言を見送ることもあります。会話履歴は共有しますが、各メンバーの個人メモと作業フォルダーは分かれています。同じモデルの4人であり、4社のモデルを比較する機能ではありません。

**4人全員が同じアカウントのCodex利用枠を共有します。枠は4倍になりません。** 新しい設定の通常モデルは`gpt-6-sol` / low、本気モードは手動で`gpt-6-astra` / medium、通常会話の同時実行は1ターンです。画像や画像説明は追加の呼び出しになるため、総利用量を保証する上限ではありません。使わないときはルームを止めてください。

画像生成モデルの初期値は`gpt-6-luna`です。不要なら`imageGen: false`を設定します。モデルと画像ツールにはアカウント側の利用権限が必要です。`config.json`の`agents.<id>.model`、`effort`、`boost`、`imageModel`を変更したらサーバーを再起動します。名前を指定してもモデルへのアクセス権は追加されません。実際の応答や画像生成はログイン済み環境で確認してください。

## 既存データと検証

内部IDは保存互換性のため、`claude` → ChatGPT-1、`gpt` → ChatGPT-2、`grok` → ChatGPT-3、`gemini` → ChatGPT-4のままです。**IDは提供元を表しません。** 会話、個人メモ、アバターのパスを保持します。旧モデル設定は読み込み時にGPT用へ変換します。サーバーは元の設定ファイルを上書きせず、セットアップで設定を保存するときはバックアップを作ります。

更新前にサーバーを停止し、`config.json`、`data/`、`workspace/`、独自キャラクター資料をバックアップします。Gitで取得した場合は`git pull --ff-only origin main`で更新します。認証情報やローカルデータはGitHubに公開しないでください。開発ブリッジは任意です。初期設定はローカル接続専用で、ローカルサーバーをそのままインターネットへ公開しないでください。

```sh
node scripts/check.mjs
node --test test/chatgpt.test.mjs test/server.test.mjs
node scripts/check-codex.mjs
```

オフラインテストは設定移行、モデル振り分け、メモ分離、共通利用枠、HTTP動作を検証します。POSIXの模擬CLIを使う統合テストだけはWindowsで省略されます。他のアダプターとサーバーのテストはWindowsでも実行されます。最後のコマンドはインストールされたCodexの実行ファイルと引数を確認するだけで、モデルは呼び出しません。

原作: [Moris-kr/ai-chatroom](https://github.com/Moris-kr/ai-chatroom)、MIT。2026-10-02に未反映だった原作の2コミットを`abca3104766ca4bbf2624c13636f0220993d0416`まで取り込んだ上で変更しています。詳しい設定、トラブルシューティング、公式資料は韓国語ガイドを参照してください。

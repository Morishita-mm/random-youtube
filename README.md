# YouTube Random Player

指定された YouTube チャンネルから、過去の動画をランダムに 1 つ選んで再生する React アプリケーションです。

## セットアップ手順

1.  **依存関係のインストール**
    ```bash
    npm install
    ```

2.  **API キーの設定**
    - [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成します。
    - **YouTube Data API v3** を有効にします。
    - API キーを作成します。
    - プロジェクトのルートに `.env.local` ファイルを作成し、以下を記述します。
      ```
      VITE_YOUTUBE_API_KEY=YOUR_API_KEY_HERE
      ```

3.  **アプリケーションの起動**
    ```bash
    npm run dev
    ```

4.  **テストの実行**
    ```bash
    npm test
    ```

## 主な機能

- **チャンネル指定**: チャンネル URL、@ハンドル名、またはチャンネル ID で指定。
- **ランダム選出**: 指定チャンネルの全アップロード動画から 1 つをランダムに選出。
- **プレイヤー**: IFrame Player API による埋め込み再生。
- **シャッフル**: 同じチャンネルから別の動画を再度ランダムに選出。

## 技術スタック

- React (Vite)
- TypeScript
- YouTube Data API v3
- Vitest / React Testing Library
- Vanilla CSS

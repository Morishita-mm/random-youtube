const API_BASE_URL = 'https://www.googleapis.com/youtube/v3';
const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

export interface YouTubeVideo {
  id: string;
  title: string;
  thumbnailUrl: string;
}

export class YouTubeService {
  /**
   * ユーザーの入力からチャンネル ID を解決します
   */
  static async resolveChannelId(input: { type: string; value: string }): Promise<string> {
    if (input.type === 'id') return input.value;

    let query = '';
    if (input.type === 'handle') query = `forHandle=${input.value.substring(1)}`;
    else if (input.type === 'user') query = `forUsername=${input.value}`;
    else if (input.type === 'custom') {
      // カスタム URL の場合は search API を使用してチャンネルを探す必要がある
      const response = await fetch(
        `${API_BASE_URL}/search?part=id&q=${input.value}&type=channel&maxResults=1&key=${API_KEY}`
      );
      const data = await response.json();
      if (!data.items?.length) throw new Error('Channel not found');
      return data.items[0].id.channelId;
    }

    const response = await fetch(
      `${API_BASE_URL}/channels?part=id&${query}&key=${API_KEY}`
    );
    const data = await response.json();
    if (!data.items?.length) throw new Error('Channel not found');
    return data.items[0].id;
  }

  /**
   * チャンネル ID から「アップロード済み動画」プレイリスト ID を取得します
   */
  static async getUploadsPlaylistId(channelId: string): Promise<string> {
    const response = await fetch(
      `${API_BASE_URL}/channels?part=contentDetails&id=${channelId}&key=${API_KEY}`
    );
    const data = await response.json();
    if (!data.items?.length) throw new Error('Channel not found');
    return data.items[0].contentDetails.relatedPlaylists.uploads;
  }

  /**
   * プレイリストから動画の総数を取得します
   */
  static async getPlaylistTotalItems(playlistId: string): Promise<number> {
    const response = await fetch(
      `${API_BASE_URL}/playlistItems?part=id&playlistId=${playlistId}&maxResults=1&key=${API_KEY}`
    );
    const data = await response.json();
    return data.pageInfo.totalResults;
  }

  /**
   * プレイリストから指定されたインデックスの動画を取得します
   */
  static async getRandomVideo(playlistId: string, totalItems: number): Promise<YouTubeVideo> {
    const randomIndex = Math.floor(Math.random() * totalItems);
    const pageToken = await this.getPageTokenForIndex(playlistId, randomIndex);
    
    // maxResults は最大 50 なので、pageToken を使って特定の位置の動画を取得
    const response = await fetch(
      `${API_BASE_URL}/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=1&pageToken=${pageToken}&key=${API_KEY}`
    );
    const data = await response.json();
    if (!data.items?.length) throw new Error('Video not found');
    
    const item = data.items[0];
    return {
      id: item.contentDetails.videoId,
      title: item.snippet.title,
      thumbnailUrl: item.snippet.thumbnails.high.url,
    };
  }

  /**
   * 特定のインデックスに対応する pageToken を取得します
   * 注: 実際には YouTube API は特定のインデックスに直接ジャンプできないため、
   * totalItems が多い場合は、50 件ずつスキップして該当のページまでトークンを辿る必要があります。
   * ここでは簡易化のため、小規模〜中規模を想定した実装にします。
   */
  private static async getPageTokenForIndex(playlistId: string, index: number): Promise<string> {
    let currentPageToken = '';
    let currentCount = 0;
    const itemsPerPage = 50;

    while (currentCount + itemsPerPage <= index) {
      const response = await fetch(
        `${API_BASE_URL}/playlistItems?part=id&playlistId=${playlistId}&maxResults=${itemsPerPage}&pageToken=${currentPageToken}&key=${API_KEY}`
      );
      const data = await response.json();
      if (!data.nextPageToken) break;
      currentPageToken = data.nextPageToken;
      currentCount += itemsPerPage;
    }

    return currentPageToken;
  }
}

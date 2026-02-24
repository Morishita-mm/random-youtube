const API_BASE_URL = 'https://www.googleapis.com/youtube/v3';
const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

export interface YouTubeVideo {
  id: string;
  title: string;
  thumbnailUrl: string;
}

export class YouTubeService {
  /**
   * チャンネル入力から、チャンネルIDとアップロード用プレイリストIDを一度に取得します
   */
  static async getChannelDetails(input: { type: string; value: string }): Promise<{ channelId: string; playlistId: string }> {
    let query = '';
    if (input.type === 'id') query = `id=${input.value}`;
    else if (input.type === 'handle') query = `forHandle=${input.value.substring(1)}`;
    else if (input.type === 'user') query = `forUsername=${input.value}`;
    else if (input.type === 'custom') {
      const searchRes = await fetch(`${API_BASE_URL}/search?part=id&q=${input.value}&type=channel&maxResults=1&key=${API_KEY}`);
      const searchData = await searchRes.json();
      if (!searchData.items?.length) throw new Error('Channel not found');
      query = `id=${searchData.items[0].id.channelId}`;
    }

    const res = await fetch(`${API_BASE_URL}/channels?part=id,contentDetails&${query}&key=${API_KEY}`);
    const data = await res.json();
    if (!data.items?.length) throw new Error('Channel not found');
    
    return {
      channelId: data.items[0].id,
      playlistId: data.items[0].contentDetails.relatedPlaylists.uploads
    };
  }

  /**
   * プレイリスト内の動画総数を取得します
   */
  static async getPlaylistTotalItems(playlistId: string): Promise<number> {
    const response = await fetch(
      `${API_BASE_URL}/playlistItems?part=id&playlistId=${playlistId}&maxResults=1&key=${API_KEY}`
    );
    const data = await response.json();
    return data.pageInfo.totalResults;
  }

  /**
   * 最近の50本からランダムに取得
   */
  static async getRandomVideoFromRecent(playlistId: string): Promise<YouTubeVideo> {
    const response = await fetch(
      `${API_BASE_URL}/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50&key=${API_KEY}`
    );
    const data = await response.json();
    if (!data.items?.length) throw new Error('No videos found');
    
    const randomIndex = Math.floor(Math.random() * data.items.length);
    const item = data.items[randomIndex];
    return {
      id: item.contentDetails.videoId,
      title: item.snippet.title,
      thumbnailUrl: item.snippet.thumbnails.high.url,
    };
  }

  /**
   * 全動画からランダムに取得 (トークンを辿るため、動画数が多いと複数リクエストが発生)
   */
  static async getRandomVideoFromAll(playlistId: string, totalItems: number): Promise<YouTubeVideo> {
    const randomIndex = Math.floor(Math.random() * totalItems);
    
    let currentPageToken = '';
    let currentCount = 0;
    const itemsPerPage = 50;

    // 目的のインデックスが含まれるページまでトークンを辿る
    while (currentCount + itemsPerPage <= randomIndex) {
      const response = await fetch(
        `${API_BASE_URL}/playlistItems?part=id&playlistId=${playlistId}&maxResults=${itemsPerPage}&pageToken=${currentPageToken}&key=${API_KEY}`
      );
      const data = await response.json();
      if (!data.nextPageToken) break;
      currentPageToken = data.nextPageToken;
      currentCount += itemsPerPage;
    }

    const response = await fetch(
      `${API_BASE_URL}/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50&pageToken=${currentPageToken}&key=${API_KEY}`
    );
    const data = await response.json();
    
    // 取得したページ内での相対インデックス
    const relativeIndex = randomIndex - currentCount;
    const item = data.items[Math.min(relativeIndex, data.items.length - 1)];
    
    return {
      id: item.contentDetails.videoId,
      title: item.snippet.title,
      thumbnailUrl: item.snippet.thumbnails.high.url,
    };
  }
}

const API_BASE_URL = 'https://www.googleapis.com/youtube/v3';
const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

export interface YouTubeVideo {
  id: string;
  title: string;
  thumbnailUrl: string;
  duration?: string; // ISO 8601 形式 (PT1M30S など)
}

export interface YouTubeChannel {
  id: string;
  title: string;
  customUrl?: string;
  thumbnailUrl: string;
  playlistId: string;
}

export class YouTubeService {
  private static videoCache: Record<string, { videos: YouTubeVideo[], isFull: boolean, total: number }> = {};

  /**
   * ISO 8601 期間文字列を秒数に変換します
   */
  static parseISODuration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');
    return hours * 3600 + minutes * 60 + seconds;
  }

  static async getChannelDetails(input: { type: string; value: string }): Promise<YouTubeChannel> {
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

    const res = await fetch(`${API_BASE_URL}/channels?part=id,snippet,contentDetails&${query}&key=${API_KEY}`);
    const data = await res.json();
    if (!data.items?.length) throw new Error('Channel not found');
    
    const channel = data.items[0];
    return {
      id: channel.id,
      title: channel.snippet.title,
      customUrl: channel.snippet.customUrl,
      thumbnailUrl: channel.snippet.thumbnails.default.url,
      playlistId: channel.contentDetails.relatedPlaylists.uploads
    };
  }

  static async getPlaylistTotalItems(playlistId: string): Promise<number> {
    const response = await fetch(`${API_BASE_URL}/playlistItems?part=id&playlistId=${playlistId}&maxResults=1&key=${API_KEY}`);
    const data = await response.json();
    return data.pageInfo.totalResults;
  }

  /**
   * キャッシュをクリアします（チャンネルリストが変更された場合などに使用）
   */
  static clearCache(playlistId?: string) {
    if (playlistId) {
      delete this.videoCache[playlistId];
    } else {
      this.videoCache = {};
    }
  }

  /**
   * フィルタ条件に合う動画を取得します
   */
  static async getRandomFilteredVideo(
    playlistId: string, 
    mode: 'recent' | 'all', 
    totalItems: number,
    filters: { minDuration: number; excludeKeywords: string[] }
  ): Promise<YouTubeVideo> {
    // キャッシュの初期化
    if (!this.videoCache[playlistId]) {
      this.videoCache[playlistId] = { videos: [], isFull: false, total: totalItems };
    }

    if (mode === 'recent') {
      // 最初の50件から取得（キャッシュがあれば利用、なければ取得）
      let items = this.videoCache[playlistId].videos.slice(0, 50);
      if (items.length === 0) {
        const response = await fetch(`${API_BASE_URL}/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50&key=${API_KEY}`);
        const data = await response.json();
        const rawItems = data.items || [];
        
        // 動画の長さを取得するために video IDs を抽出
        const videoIds = rawItems.map((i: any) => i.contentDetails.videoId).join(',');
        const videoDetails = await this.getVideoDetails(videoIds);
        
        items = rawItems.map((item: any) => ({
          id: item.contentDetails.videoId,
          title: item.snippet.title,
          thumbnailUrl: item.snippet.thumbnails.high.url,
          duration: videoDetails[item.contentDetails.videoId]?.duration
        }));
        
        // 最初の50件をキャッシュに保存（全期間取得の足がかりにする）
        this.videoCache[playlistId].videos = [...items];
      }

      const filtered = items.filter(video => {
        if (!video.duration) return false;
        const duration = this.parseISODuration(video.duration);
        const title = video.title.toLowerCase();
        const isLongEnough = duration >= filters.minDuration;
        const hasNoExcludedKeywords = !filters.excludeKeywords.some(kw => title.includes(kw.toLowerCase()));
        return isLongEnough && hasNoExcludedKeywords;
      });

      if (filtered.length === 0) throw new Error('No videos match filters in recent 50');
      return filtered[Math.floor(Math.random() * filtered.length)];

    } else {
      // 'all' mode
      // キャッシュが空なら、まず最初の50件を取得して1本目を即座に返す（バックグラウンドで全件取得開始）
      if (this.videoCache[playlistId].videos.length === 0) {
        const video = await this.getRandomFilteredVideo(playlistId, 'recent', totalItems, filters);
        // バックグラウンドで全件取得を開始
        this.fetchAllPlaylistItemsInBackground(playlistId);
        return video;
      }

      // キャッシュが全件揃っていない場合は、現在あるキャッシュから選ぶ（並行して取得が進んでいる）
      // または、もし最初の50件取得直後なら、全件取得を待つのではなく、現在あるキャッシュから返す
      const sourceList = this.videoCache[playlistId].videos;
      const filtered = sourceList.filter(video => {
        if (!video.duration) return false;
        const duration = this.parseISODuration(video.duration);
        const title = video.title.toLowerCase();
        return duration >= filters.minDuration && !filters.excludeKeywords.some(kw => title.includes(kw.toLowerCase()));
      });

      if (filtered.length > 0) {
        // 全件取得が終わっていない場合も、一旦今ある中からランダムに返す
        const video = filtered[Math.floor(Math.random() * filtered.length)];
        
        // まだ全件取得が始まっていない、かつ完了もしていない場合は開始する
        if (!this.videoCache[playlistId].isFull) {
          this.fetchAllPlaylistItemsInBackground(playlistId);
        }
        
        return video;
      }

      // フィルタに合うものが現在取得済みのリストにない場合、全件取得を待つか、再試行
      if (!this.videoCache[playlistId].isFull) {
        await this.fetchAllPlaylistItemsInBackground(playlistId); // ここでは完了を待つ
        return this.getRandomFilteredVideo(playlistId, 'all', totalItems, filters); // 再試行
      }

      throw new Error('Failed to find a video matching filters in all history');
    }
  }

  /**
   * バックグラウンドで全件取得を行います
   */
  private static async fetchAllPlaylistItemsInBackground(playlistId: string): Promise<void> {
    const cache = this.videoCache[playlistId];
    if (cache.isFull) return;

    // すでに取得が進行中かどうかを判定（簡易的に videos.length > 50 で判定）
    if (cache.videos.length > 50) return;

    let nextPageToken = '';
    // 最初の50件はすでに取得済みのはずだが、pageToken を取得するために1回リクエストが必要
    const firstRes = await fetch(`${API_BASE_URL}/playlistItems?part=id&playlistId=${playlistId}&maxResults=50&key=${API_KEY}`);
    const firstData = await firstRes.json();
    nextPageToken = firstData.nextPageToken;

    while (nextPageToken) {
      const response = await fetch(`${API_BASE_URL}/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50&pageToken=${nextPageToken}&key=${API_KEY}`);
      const data = await response.json();
      
      const rawItems = data.items || [];
      const videoIds = rawItems.map((i: any) => i.contentDetails.videoId).join(',');
      const videoDetails = await this.getVideoDetails(videoIds);
      
      const newVideos = rawItems.map((item: any) => ({
        id: item.contentDetails.videoId,
        title: item.snippet.title,
        thumbnailUrl: item.snippet.thumbnails.high.url,
        duration: videoDetails[item.contentDetails.videoId]?.duration
      }));

      cache.videos = [...cache.videos, ...newVideos];
      nextPageToken = data.nextPageToken;
    }

    cache.isFull = true;
    console.log(`Cache full for ${playlistId}: ${cache.videos.length} videos`);
  }

  private static async getVideoDetails(videoIds: string): Promise<Record<string, { duration: string }>> {
    const response = await fetch(`${API_BASE_URL}/videos?part=contentDetails&id=${videoIds}&key=${API_KEY}`);
    const data = await response.json();
    const result: Record<string, { duration: string }> = {};
    data.items?.forEach((item: any) => {
      result[item.id] = { duration: item.contentDetails.duration };
    });
    return result;
  }
}


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
   * フィルタ条件に合う動画を取得します
   */
  static async getRandomFilteredVideo(
    playlistId: string, 
    mode: 'recent' | 'all', 
    totalItems: number,
    filters: { minDuration: number; excludeKeywords: string[] }
  ): Promise<YouTubeVideo> {
    let attempts = 0;
    const maxAttempts = mode === 'recent' ? 1 : 5; // recent は一括取得するので1回、all は都度取得なので5回まで

    if (mode === 'recent') {
      const response = await fetch(`${API_BASE_URL}/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50&key=${API_KEY}`);
      const data = await response.json();
      const items = data.items || [];
      
      // 動画の長さを取得するために video IDs を抽出
      const videoIds = items.map((i: any) => i.contentDetails.videoId).join(',');
      const videoDetails = await this.getVideoDetails(videoIds);
      
      const filtered = items.filter((item: any) => {
        const details = videoDetails[item.contentDetails.videoId];
        if (!details) return false;
        
        const duration = this.parseISODuration(details.duration);
        const title = item.snippet.title.toLowerCase();
        
        const isLongEnough = duration >= filters.minDuration;
        const hasNoExcludedKeywords = !filters.excludeKeywords.some(kw => title.includes(kw.toLowerCase()));
        
        return isLongEnough && hasNoExcludedKeywords;
      });

      if (filtered.length === 0) throw new Error('No videos match filters in recent 50');
      const item = filtered[Math.floor(Math.random() * filtered.length)];
      return {
        id: item.contentDetails.videoId,
        title: item.snippet.title,
        thumbnailUrl: item.snippet.thumbnails.high.url,
        duration: videoDetails[item.contentDetails.videoId].duration
      };
    } else {
      // 'all' mode
      while (attempts < maxAttempts) {
        attempts++;
        const randomIndex = Math.floor(Math.random() * totalItems);
        const item = await this.fetchSinglePlaylistItem(playlistId, randomIndex);
        const videoDetails = await this.getVideoDetails(item.contentDetails.videoId);
        const details = videoDetails[item.contentDetails.videoId];
        
        if (details) {
          const duration = this.parseISODuration(details.duration);
          const title = item.snippet.title.toLowerCase();
          
          if (duration >= filters.minDuration && !filters.excludeKeywords.some(kw => title.includes(kw.toLowerCase()))) {
            return {
              id: item.contentDetails.videoId,
              title: item.snippet.title,
              thumbnailUrl: item.snippet.thumbnails.high.url,
              duration: details.duration
            };
          }
        }
      }
      throw new Error('Failed to find a video matching filters after several attempts');
    }
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

  private static async fetchSinglePlaylistItem(playlistId: string, index: number): Promise<any> {
    let currentPageToken = '';
    let currentCount = 0;
    const itemsPerPage = 50;

    while (currentCount + itemsPerPage <= index) {
      const response = await fetch(`${API_BASE_URL}/playlistItems?part=id&playlistId=${playlistId}&maxResults=${itemsPerPage}&pageToken=${currentPageToken}&key=${API_KEY}`);
      const data = await response.json();
      if (!data.nextPageToken) break;
      currentPageToken = data.nextPageToken;
      currentCount += itemsPerPage;
    }

    const response = await fetch(`${API_BASE_URL}/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50&pageToken=${currentPageToken}&key=${API_KEY}`);
    const data = await response.json();
    const relativeIndex = index - currentCount;
    return data.items[Math.min(relativeIndex, data.items.length - 1)];
  }
}

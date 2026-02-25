import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YouTubeService } from './youtubeService';

describe('YouTubeService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('getChannelDetails should return channel info', async () => {
    const mockResponse = {
      items: [
        {
          id: 'UC-lHJZR3Gqxm24_Vd_AJ5Yw',
          snippet: {
            title: 'Test Channel',
            thumbnails: { default: { url: 'icon-url' } }
          },
          contentDetails: {
            relatedPlaylists: {
              uploads: 'UUC-lHJZR3Gqxm24_Vd_AJ5Yw'
            }
          }
        }
      ]
    };
    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    const result = await YouTubeService.getChannelDetails({ type: 'id', value: 'UC-lHJZR3Gqxm24_Vd_AJ5Yw' });
    expect(result.id).toBe('UC-lHJZR3Gqxm24_Vd_AJ5Yw');
    expect(result.title).toBe('Test Channel');
    expect(result.playlistId).toBe('UUC-lHJZR3Gqxm24_Vd_AJ5Yw');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('endpoint=channels'));
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('id=UC-lHJZR3Gqxm24_Vd_AJ5Yw'));
  });

  it('getPlaylistTotalItems should return total items', async () => {
    const mockResponse = {
      pageInfo: {
        totalResults: 123
      }
    };
    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    const result = await YouTubeService.getPlaylistTotalItems('UUC-lHJZR3Gqxm24_Vd_AJ5Yw');
    expect(result).toBe(123);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('endpoint=playlistItems'));
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('playlistId=UUC-lHJZR3Gqxm24_Vd_AJ5Yw'));
  });

  it('getRandomFilteredVideo in "all" mode should fetch first page and then background fetch', async () => {
    // Reset cache before test
    YouTubeService.clearCache();

    // 1. fetch for first page items
    // 2. fetch for video details of those items
    // (Then background fetch happens, which we can optionally mock)
    
    (fetch as any)
      .mockResolvedValueOnce({ // playlistItems (1st page)
        ok: true,
        json: () => Promise.resolve({ 
          nextPageToken: 'token2',
          items: [{ 
            snippet: { title: 'First Video', thumbnails: { high: { url: 'thumb' } } },
            contentDetails: { videoId: 'vid1' }
          }] 
        })
      })
      .mockResolvedValueOnce({ // videoDetails
        ok: true,
        json: () => Promise.resolve({ 
          items: [{ id: 'vid1', contentDetails: { duration: 'PT10M' } }] 
        })
      })
      .mockResolvedValueOnce({ // background fetch - 1st page for token
        ok: true,
        json: () => Promise.resolve({ nextPageToken: 'token2' })
      })
      .mockResolvedValueOnce({ // background fetch - 2nd page data
        ok: true,
        json: () => Promise.resolve({ 
          nextPageToken: null,
          items: [{ 
            snippet: { title: 'Second Video', thumbnails: { high: { url: 'thumb' } } },
            contentDetails: { videoId: 'vid2' }
          }] 
        })
      })
      .mockResolvedValueOnce({ // background fetch - videoDetails for vid2
        ok: true,
        json: () => Promise.resolve({ 
          items: [{ id: 'vid2', contentDetails: { duration: 'PT5M' } }] 
        })
      });

    const result = await YouTubeService.getRandomFilteredVideo(
      'playlist-id', 
      'all', 
      100, 
      { minDuration: 0, excludeKeywords: [] }
    );

    expect(result.id).toBe('vid1');
    // At this point, background fetch might still be running or finished
    // The first two calls are for the initial video
    expect(fetch).toHaveBeenCalled(); 
    
    vi.restoreAllMocks();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YouTubeService } from './youtubeService';

describe('YouTubeService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    // import.meta.env.VITE_YOUTUBE_API_KEY をモックする必要があるかもしれない
  });

  it('getUploadsPlaylistId should return playlist ID', async () => {
    const mockResponse = {
      items: [
        {
          contentDetails: {
            relatedPlaylists: {
              uploads: 'UUC-lHJZR3Gqxm24_Vd_AJ5Yw'
            }
          }
        }
      ]
    };
    (fetch as any).mockResolvedValue({
      json: () => Promise.resolve(mockResponse)
    });

    const result = await YouTubeService.getUploadsPlaylistId('UC-lHJZR3Gqxm24_Vd_AJ5Yw');
    expect(result).toBe('UUC-lHJZR3Gqxm24_Vd_AJ5Yw');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('channels?part=contentDetails&id=UC-lHJZR3Gqxm24_Vd_AJ5Yw'));
  });

  it('getPlaylistTotalItems should return total items', async () => {
    const mockResponse = {
      pageInfo: {
        totalResults: 123
      }
    };
    (fetch as any).mockResolvedValue({
      json: () => Promise.resolve(mockResponse)
    });

    const result = await YouTubeService.getPlaylistTotalItems('UUC-lHJZR3Gqxm24_Vd_AJ5Yw');
    expect(result).toBe(123);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('playlistItems?part=id&playlistId=UUC-lHJZR3Gqxm24_Vd_AJ5Yw'));
  });
});

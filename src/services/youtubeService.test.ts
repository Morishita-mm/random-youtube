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
      json: () => Promise.resolve(mockResponse)
    });

    const result = await YouTubeService.getChannelDetails({ type: 'id', value: 'UC-lHJZR3Gqxm24_Vd_AJ5Yw' });
    expect(result.id).toBe('UC-lHJZR3Gqxm24_Vd_AJ5Yw');
    expect(result.title).toBe('Test Channel');
    expect(result.playlistId).toBe('UUC-lHJZR3Gqxm24_Vd_AJ5Yw');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('channels?part=id,snippet,contentDetails&id=UC-lHJZR3Gqxm24_Vd_AJ5Yw'));
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

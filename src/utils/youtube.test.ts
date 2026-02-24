import { describe, it, expect } from 'vitest';
import { parseYouTubeInput } from './youtube';

describe('parseYouTubeInput', () => {
  it('should extract channel ID from full channel URL', () => {
    const input = 'https://www.youtube.com/channel/UC-lHJZR3Gqxm24_Vd_AJ5Yw';
    expect(parseYouTubeInput(input)).toEqual({ type: 'id', value: 'UC-lHJZR3Gqxm24_Vd_AJ5Yw' });
  });

  it('should extract handle from handle URL', () => {
    const input = 'https://www.youtube.com/@YouTube';
    expect(parseYouTubeInput(input)).toEqual({ type: 'handle', value: '@YouTube' });
  });

  it('should handle raw channel ID', () => {
    const input = 'UC-lHJZR3Gqxm24_Vd_AJ5Yw';
    expect(parseYouTubeInput(input)).toEqual({ type: 'id', value: 'UC-lHJZR3Gqxm24_Vd_AJ5Yw' });
  });

  it('should handle raw handle', () => {
    const input = '@YouTube';
    expect(parseYouTubeInput(input)).toEqual({ type: 'handle', value: '@YouTube' });
  });

  it('should handle custom channel URL as handle candidate', () => {
    const input = 'https://www.youtube.com/c/YouTubeJapan';
    expect(parseYouTubeInput(input)).toEqual({ type: 'custom', value: 'YouTubeJapan' });
  });

  it('should return null for invalid input', () => {
    const input = 'invalid-input';
    expect(parseYouTubeInput(input)).toEqual(null);
  });
});

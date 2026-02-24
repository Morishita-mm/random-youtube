export type YouTubeInput = {
  type: 'id' | 'handle' | 'custom' | 'user';
  value: string;
};

/**
 * YouTube のチャンネル URL または ID から種類と値を抽出します
 * @param input ユーザーの入力 (URL, @handle, channel ID)
 * @returns 抽出された情報、または null
 */
export function parseYouTubeInput(input: string): YouTubeInput | null {
  const trimmed = input.trim();

  // 1. Channel ID (UC...)
  if (/^UC[\w-]{22}$/.test(trimmed)) {
    return { type: 'id', value: trimmed };
  }

  // 2. Handle (@...)
  if (/^@[\w.-]+$/.test(trimmed)) {
    return { type: 'handle', value: trimmed };
  }

  try {
    const url = new URL(trimmed);
    if (!url.hostname.includes('youtube.com')) return null;

    const path = url.pathname.split('/').filter(Boolean);
    if (path.length === 0) return null;

    // channel/UC...
    if (path[0] === 'channel' && path[1]?.startsWith('UC')) {
      return { type: 'id', value: path[1] };
    }

    // @handle
    if (path[0]?.startsWith('@')) {
      return { type: 'handle', value: path[0] };
    }

    // c/custom-name
    if (path[0] === 'c' && path[1]) {
      return { type: 'custom', value: path[1] };
    }

    // user/username
    if (path[0] === 'user' && path[1]) {
      return { type: 'user', value: path[1] };
    }

    return null;
  } catch {
    // URL として解析できない場合は null を返す
    return null;
  }
}

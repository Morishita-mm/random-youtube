export default async function handler(req: any, res: any) {
  const { endpoint, ...params } = req.query;

  if (!endpoint) {
    return res.status(400).json({ error: 'Missing endpoint' });
  }

  const API_KEY = process.env.YOUTUBE_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'YouTube API Key not configured' });
  }

  const API_BASE_URL = 'https://www.googleapis.com/youtube/v3';
  const queryString = new URLSearchParams({
    ...params,
    key: API_KEY
  }).toString();

  const url = `${API_BASE_URL}/${endpoint}?${queryString}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    
    // CORS ヘッダーを設定（必要に応じて）
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

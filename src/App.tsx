import { useState, useCallback } from 'react';
import './App.css';
import { parseYouTubeInput } from './utils/youtube';
import { YouTubeService } from './services/youtubeService';
import type { YouTubeVideo } from './services/youtubeService';
import YouTubePlayer from './components/YouTubePlayer';

function App() {
  const [input, setInput] = useState('');
  const [currentVideo, setCurrentVideo] = useState<YouTubeVideo | null>(null);
  const [playlistId, setPlaylistId] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRandomVideo = useCallback(async (pId: string, total: number) => {
    setLoading(true);
    setError(null);
    try {
      const video = await YouTubeService.getRandomVideo(pId, total);
      setCurrentVideo(video);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch video');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input) return;

    setLoading(true);
    setError(null);
    setCurrentVideo(null);
    setPlaylistId(null);

    try {
      const parsed = parseYouTubeInput(input);
      if (!parsed) throw new Error('Invalid YouTube channel URL or ID');

      const channelId = await YouTubeService.resolveChannelId(parsed);
      const pId = await YouTubeService.getUploadsPlaylistId(channelId);
      const total = await YouTubeService.getPlaylistTotalItems(pId);

      setPlaylistId(pId);
      setTotalItems(total);
      
      await fetchRandomVideo(pId, total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleShuffle = () => {
    if (playlistId && totalItems > 0) {
      fetchRandomVideo(playlistId, totalItems);
    }
  };

  return (
    <div className="container">
      <h1 className="title">YouTube Random Player</h1>
      <form onSubmit={handleSearch} className="input-group">
        <input
          type="text"
          className="input"
          placeholder="Channel URL, handle (@...) or ID"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <button type="submit" className="button" disabled={loading || !input}>
          Search
        </button>
      </form>

      {error && <div className="error">{error}</div>}

      {loading && <div className="loading">Loading...</div>}

      {currentVideo && (
        <div className="video-info">
          <YouTubePlayer videoId={currentVideo.id} />
          <div className="video-title">{currentVideo.title}</div>
          <button 
            className="button shuffle-button" 
            onClick={handleShuffle}
            disabled={loading}
          >
            Another Video
          </button>
        </div>
      )}

      {!currentVideo && !loading && !error && (
        <div className="instructions">
          Enter a YouTube channel to play a random video from their history.
        </div>
      )}
    </div>
  );
}

export default App;

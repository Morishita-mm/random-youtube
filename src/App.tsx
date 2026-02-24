import { useState, useCallback } from 'react';
import './App.css';
import { parseYouTubeInput } from './utils/youtube';
import { YouTubeService } from './services/youtubeService';
import type { YouTubeVideo, YouTubeChannel } from './services/youtubeService';
import YouTubePlayer from './components/YouTubePlayer';

type SelectionMode = 'recent' | 'all';

function App() {
  const [input, setInput] = useState('');
  const [currentVideo, setCurrentVideo] = useState<YouTubeVideo | null>(null);
  const [nextVideo, setNextVideo] = useState<YouTubeVideo | null>(null);
  const [activeChannel, setActiveChannel] = useState<YouTubeChannel | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [mode, setMode] = useState<SelectionMode>('recent');
  
  const [loading, setLoading] = useState(false);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVideo = useCallback(async (pId: string, t: number, m: SelectionMode) => {
    if (m === 'recent') {
      return await YouTubeService.getRandomVideoFromRecent(pId);
    } else {
      return await YouTubeService.getRandomVideoFromAll(pId, t);
    }
  }, []);

  const prefetchNextVideo = useCallback(async (pId: string, t: number, m: SelectionMode) => {
    setIsPrefetching(true);
    try {
      const video = await fetchVideo(pId, t, m);
      setNextVideo(video);
    } catch (err) {
      console.error('Failed to prefetch next video:', err);
    } finally {
      setIsPrefetching(false);
    }
  }, [fetchVideo]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input) return;

    setLoading(true);
    setError(null);
    setCurrentVideo(null);
    setNextVideo(null);
    setActiveChannel(null);

    try {
      const parsed = parseYouTubeInput(input);
      if (!parsed) throw new Error('Invalid YouTube channel URL or ID');

      const details = await YouTubeService.getChannelDetails(parsed);
      const total = await YouTubeService.getPlaylistTotalItems(details.playlistId);
      
      setActiveChannel(details);
      setTotalItems(total);
      
      const firstVideo = await fetchVideo(details.playlistId, total, mode);
      setCurrentVideo(firstVideo);
      
      prefetchNextVideo(details.playlistId, total, mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleShuffle = useCallback(() => {
    if (!activeChannel) return;

    if (nextVideo) {
      setCurrentVideo(nextVideo);
      setNextVideo(null);
      prefetchNextVideo(activeChannel.playlistId, totalItems, mode);
    } else {
      setLoading(true);
      fetchVideo(activeChannel.playlistId, totalItems, mode)
        .then((video) => {
          setCurrentVideo(video);
          prefetchNextVideo(activeChannel.playlistId, totalItems, mode);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [activeChannel, nextVideo, totalItems, mode, fetchVideo, prefetchNextVideo]);

  const onVideoEnd = useCallback(() => {
    if (autoPlay) {
      handleShuffle();
    }
  }, [autoPlay, handleShuffle]);

  return (
    <div className="container">
      <h1 className="title">YouTube Random Player</h1>
      
      <div className="mode-selector">
        <label className={`mode-button ${mode === 'recent' ? 'active' : ''}`}>
          <input 
            type="radio" 
            name="mode" 
            value="recent" 
            checked={mode === 'recent'} 
            onChange={() => setMode('recent')} 
          />
          Recent (Fast)
        </label>
        <label className={`mode-button ${mode === 'all' ? 'active' : ''}`}>
          <input 
            type="radio" 
            name="mode" 
            value="all" 
            checked={mode === 'all'} 
            onChange={() => setMode('all')} 
          />
          All History
        </label>
      </div>

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

      {currentVideo && activeChannel && (
        <div className="video-info">
          <div className="player-header">
            <div className="channel-badge">
              <img src={activeChannel.thumbnailUrl} alt={activeChannel.title} className="channel-icon" />
              <span className="channel-name">{activeChannel.title}</span>
            </div>
            <div className="controls-row">
              <label className="toggle-container">
                <input 
                  type="checkbox" 
                  checked={autoPlay} 
                  onChange={(e) => setAutoPlay(e.target.checked)} 
                />
                <span className="toggle-label">Auto Play Next</span>
              </label>
            </div>
          </div>
          
          <YouTubePlayer videoId={currentVideo.id} onEnd={onVideoEnd} />
          
          <div className="video-title">{currentVideo.title}</div>
          
          <button 
            className="button shuffle-button" 
            onClick={handleShuffle}
            disabled={loading}
          >
            {isPrefetching && !nextVideo ? 'Fetching Next...' : 'Another Video'}
          </button>
        </div>
      )}

      {!currentVideo && !loading && !error && (
        <div className="instructions">
          Enter a YouTube channel to play a random video from their {mode === 'recent' ? 'recent 50 videos' : 'entire history'}.
        </div>
      )}
    </div>
  );
}

export default App;

import { useState, useCallback, useEffect } from 'react';
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
  const [nextVideoChannel, setNextVideoChannel] = useState<YouTubeChannel | null>(null);
  const [currentVideoChannel, setCurrentVideoChannel] = useState<YouTubeChannel | null>(null);
  
  const [channels, setChannels] = useState<YouTubeChannel[]>([]);
  const [mode, setMode] = useState<SelectionMode>('recent');
  
  const [loading, setLoading] = useState(false);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load channels from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('yt-random-channels');
    if (saved) {
      try {
        setChannels(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load saved channels', e);
      }
    }
  }, []);

  // Save channels to localStorage when changed
  useEffect(() => {
    localStorage.setItem('yt-random-channels', JSON.stringify(channels));
  }, [channels]);

  const fetchRandomVideoFromChannel = useCallback(async (channel: YouTubeChannel, m: SelectionMode) => {
    if (m === 'recent') {
      return await YouTubeService.getRandomVideoFromRecent(channel.playlistId);
    } else {
      const total = await YouTubeService.getPlaylistTotalItems(channel.playlistId);
      return await YouTubeService.getRandomVideoFromAll(channel.playlistId, total);
    }
  }, []);

  const prefetchNextVideo = useCallback(async (targetChannels: YouTubeChannel[], m: SelectionMode) => {
    if (targetChannels.length === 0) return;
    setIsPrefetching(true);
    try {
      const randomChannel = targetChannels[Math.floor(Math.random() * targetChannels.length)];
      const video = await fetchRandomVideoFromChannel(randomChannel, m);
      setNextVideo(video);
      setNextVideoChannel(randomChannel);
    } catch (err) {
      console.error('Failed to prefetch next video:', err);
    } finally {
      setIsPrefetching(false);
    }
  }, [fetchRandomVideoFromChannel]);

  const handleAddChannels = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input) return;

    setLoading(true);
    setError(null);

    // Split by whitespace to support multiple inputs
    const inputs = input.split(/\s+/).filter(Boolean);
    const newChannels: YouTubeChannel[] = [...channels];

    try {
      for (const val of inputs) {
        const parsed = parseYouTubeInput(val);
        if (!parsed) continue;

        // Skip if already added
        if (newChannels.some(c => c.id === parsed.value || c.customUrl?.includes(parsed.value))) continue;

        const details = await YouTubeService.getChannelDetails(parsed);
        newChannels.push(details);
      }
      
      setChannels(newChannels);
      setInput('');

      // If it's the first time adding channels, start playing
      if (currentVideo === null && newChannels.length > 0) {
        const randomChannel = newChannels[Math.floor(Math.random() * newChannels.length)];
        const video = await fetchRandomVideoFromChannel(randomChannel, mode);
        setCurrentVideo(video);
        setCurrentVideoChannel(randomChannel);
        prefetchNextVideo(newChannels, mode);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleShuffle = useCallback(() => {
    if (channels.length === 0) return;

    if (nextVideo && nextVideoChannel) {
      setCurrentVideo(nextVideo);
      setCurrentVideoChannel(nextVideoChannel);
      setNextVideo(null);
      setNextVideoChannel(null);
      prefetchNextVideo(channels, mode);
    } else {
      setLoading(true);
      const randomChannel = channels[Math.floor(Math.random() * channels.length)];
      fetchRandomVideoFromChannel(randomChannel, mode)
        .then((video) => {
          setCurrentVideo(video);
          setCurrentVideoChannel(randomChannel);
          prefetchNextVideo(channels, mode);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [channels, nextVideo, nextVideoChannel, mode, fetchRandomVideoFromChannel, prefetchNextVideo]);

  const removeChannel = (id: string) => {
    setChannels(prev => prev.filter(c => c.id !== id));
  };

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
          <input type="radio" name="mode" value="recent" checked={mode === 'recent'} onChange={() => setMode('recent')} />
          Recent
        </label>
        <label className={`mode-button ${mode === 'all' ? 'active' : ''}`}>
          <input type="radio" name="mode" value="all" checked={mode === 'all'} onChange={() => setMode('all')} />
          All History
        </label>
      </div>

      <form onSubmit={handleAddChannels} className="input-group">
        <input
          type="text"
          className="input"
          placeholder="Add Channel URLs or IDs (space separated)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <button type="submit" className="button" disabled={loading || !input}>
          Add
        </button>
      </form>

      {channels.length > 0 && (
        <div className="channel-list">
          {channels.map(channel => (
            <div key={channel.id} className="channel-chip">
              <img src={channel.thumbnailUrl} alt={channel.title} />
              <span className="tooltip">{channel.title}</span>
              <button className="remove-btn" onClick={() => removeChannel(channel.id)}>&times;</button>
            </div>
          ))}
          {channels.length > 0 && (
            <button className="clear-btn" onClick={() => { setChannels([]); setCurrentVideo(null); }}>Clear All</button>
          )}
        </div>
      )}

      {error && <div className="error">{error}</div>}
      {loading && <div className="loading">Loading...</div>}

      {currentVideo && currentVideoChannel && (
        <div className="video-info">
          <div className="player-header">
            <div className="channel-badge">
              <img src={currentVideoChannel.thumbnailUrl} alt={currentVideoChannel.title} className="channel-icon" />
              {channels.length === 1 && <span className="channel-name">{currentVideoChannel.title}</span>}
            </div>
            <div className="controls-row">
              <label className="toggle-container">
                <input type="checkbox" checked={autoPlay} onChange={(e) => setAutoPlay(e.target.checked)} />
                <span className="toggle-label">Auto Play Next</span>
              </label>
            </div>
          </div>
          
          <YouTubePlayer videoId={currentVideo.id} onEnd={onVideoEnd} />
          
          <div className="video-title">{currentVideo.title}</div>
          
          <button className="button shuffle-button" onClick={handleShuffle} disabled={loading}>
            {isPrefetching && !nextVideo ? 'Fetching Next...' : 'Another Video'}
          </button>
        </div>
      )}

      {channels.length === 0 && !loading && !error && (
        <div className="instructions">
          Add one or more YouTube channels to start the random player.
        </div>
      )}
    </div>
  );
}

export default App;

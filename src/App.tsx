import { useState, useCallback, useEffect } from 'react';
import './App.css';
import { parseYouTubeInput } from './utils/youtube';
import { YouTubeService } from './services/youtubeService';
import type { YouTubeVideo, YouTubeChannel } from './services/youtubeService';
import YouTubePlayer from './components/YouTubePlayer';

type SelectionMode = 'recent' | 'all';

interface Filters {
  minDuration: number;
  excludeKeywords: string[];
}

function App() {
  const [input, setInput] = useState('');
  const [currentVideo, setCurrentVideo] = useState<YouTubeVideo | null>(null);
  const [nextVideo, setNextVideo] = useState<YouTubeVideo | null>(null);
  const [nextVideoChannel, setNextVideoChannel] = useState<YouTubeChannel | null>(null);
  const [currentVideoChannel, setCurrentVideoChannel] = useState<YouTubeChannel | null>(null);
  
  const [channels, setChannels] = useState<YouTubeChannel[]>([]);
  const [mode, setMode] = useState<SelectionMode>('recent');
  const [filters, setFilters] = useState<Filters>({
    minDuration: 120,
    excludeKeywords: ['short', '#shorts', 'ショート']
  });
  
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedChannels = localStorage.getItem('yt-random-channels');
    if (savedChannels) {
      try { setChannels(JSON.parse(savedChannels)); } catch (e) { console.error(e); }
    }
    const savedFilters = localStorage.getItem('yt-random-filters');
    if (savedFilters) {
      try { setFilters(JSON.parse(savedFilters)); } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('yt-random-channels', JSON.stringify(channels));
  }, [channels]);

  useEffect(() => {
    localStorage.setItem('yt-random-filters', JSON.stringify(filters));
  }, [filters]);

  const fetchRandomVideoFromChannel = useCallback(async (channel: YouTubeChannel, m: SelectionMode) => {
    const total = await YouTubeService.getPlaylistTotalItems(channel.playlistId);
    return await YouTubeService.getRandomFilteredVideo(channel.playlistId, m, total, filters);
  }, [filters]);

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

    const inputs = input.split(/\s+/).filter(Boolean);
    const newChannels: YouTubeChannel[] = [...channels];

    try {
      for (const val of inputs) {
        const parsed = parseYouTubeInput(val);
        if (!parsed) continue;
        if (newChannels.some(c => c.id === parsed.value)) continue;
        const details = await YouTubeService.getChannelDetails(parsed);
        newChannels.push(details);
      }
      
      setChannels(newChannels);
      setInput('');

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
    const channelToRemove = channels.find(c => c.id === id);
    if (channelToRemove) {
      YouTubeService.clearCache(channelToRemove.playlistId);
    }
    setChannels(prev => prev.filter(c => c.id !== id));
  };

  const onVideoEnd = useCallback(() => {
    if (autoPlay) {
      handleShuffle();
    }
  }, [autoPlay, handleShuffle]);

  return (
    <div className="container">
      <div className="header-top">
        <h1 className="title">YouTube Random Player</h1>
        <button className="settings-toggle" onClick={() => setShowSettings(!showSettings)}>
          {showSettings ? '✕' : '⚙ Settings'}
        </button>
      </div>
      
      {showSettings && (
        <div className="settings-panel">
          <div className="settings-group">
            <label>Min Duration (seconds):</label>
            <input 
              type="number" 
              value={filters.minDuration} 
              onChange={(e) => setFilters({...filters, minDuration: parseInt(e.target.value) || 0})}
            />
          </div>
          <div className="settings-group">
            <label>Exclude Keywords (comma separated):</label>
            <input 
              type="text" 
              value={filters.excludeKeywords.join(', ')} 
              onChange={(e) => setFilters({...filters, excludeKeywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
            />
          </div>
        </div>
      )}

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
          placeholder="Add Channel URLs or IDs"
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
            <div key={channel.id} className={`channel-chip ${currentVideoChannel?.id === channel.id ? 'active' : ''}`}>
              <img src={channel.thumbnailUrl} alt={channel.title} />
              <span className="tooltip">{channel.title}</span>
              <button className="remove-btn" onClick={() => removeChannel(channel.id)}>&times;</button>
            </div>
          ))}
          <button className="clear-btn" onClick={() => { 
            YouTubeService.clearCache();
            setChannels([]); 
            setCurrentVideo(null); 
          }}>Clear All</button>
        </div>
      )}

      {error && <div className="error">{error}</div>}
      {loading && <div className="loading">Loading Filtering Videos...</div>}

      {currentVideo && (
        <div className="video-info">
          <YouTubePlayer videoId={currentVideo.id} onEnd={onVideoEnd} />
          
          <div className="video-title-row">
            <div className="video-title">{currentVideo.title}</div>
            <div className="controls-row">
              <label className="toggle-container">
                <input type="checkbox" checked={autoPlay} onChange={(e) => setAutoPlay(e.target.checked)} />
                <span className="toggle-label">Auto Play Next</span>
              </label>
            </div>
          </div>
          
          <button className="button shuffle-button" onClick={handleShuffle} disabled={loading}>
            {isPrefetching && !nextVideo ? 'Filtering Next...' : 'Another Video'}
          </button>
        </div>
      )}

      {channels.length === 0 && !loading && !error && (
        <div className="instructions">
          Add YouTube channels to start. (Shorts are filtered by default)
        </div>
      )}
    </div>
  );
}

export default App;

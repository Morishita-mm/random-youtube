import React, { useEffect, useRef } from 'react';

interface YouTubePlayerProps {
  videoId: string;
  onEnd?: () => void;
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ videoId, onEnd }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const onEndRef = useRef(onEnd);

  // 最新の onEnd コールバックを常に参照できるように更新
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const createPlayer = () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.error('Error destroying player:', e);
        }
        playerRef.current = null;
      }

      if (!containerRef.current) return;
      containerRef.current.innerHTML = '<div id="youtube-player-element"></div>';

      playerRef.current = new window.YT.Player('youtube-player-element', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          enablejsapi: 1,
          origin: window.location.origin,
          rel: 0,
        },
        events: {
          onStateChange: (event: any) => {
            // YT.PlayerState.ENDED is 0
            if (event.data === 0) {
              onEndRef.current?.();
            }
          },
          onError: (e: any) => {
            console.error('YouTube Player Error:', e.data);
          }
        },
      });
    };

    if (window.YT && window.YT.Player) {
      createPlayer();
    } else {
      const prevOnReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevOnReady) prevOnReady();
        createPlayer();
      };
    }

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          // ignore
        }
        playerRef.current = null;
      }
    };
  }, [videoId]); // videoId が変わるたびに再作成 (これにより確実に新しい動画が開始される)

  return (
    <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', height: 0, backgroundColor: '#000' }}>
      <div 
        ref={containerRef} 
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      />
    </div>
  );
};

export default YouTubePlayer;

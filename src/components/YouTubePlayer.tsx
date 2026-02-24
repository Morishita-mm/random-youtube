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
  const isReadyRef = useRef(false);

  // コールバックを常に最新の状態に保つ
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    // API スクリプトの読み込み
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const initPlayer = () => {
      if (playerRef.current) return;

      if (!containerRef.current) return;
      // プレースホルダー要素を作成
      const playerElement = document.createElement('div');
      containerRef.current.appendChild(playerElement);

      playerRef.current = new window.YT.Player(playerElement, {
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
          onReady: () => {
            isReadyRef.current = true;
          },
          onStateChange: (event: any) => {
            // 0: ENDED
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
      initPlayer();
    } else {
      const prevOnReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevOnReady) prevOnReady();
        initPlayer();
      };
    }

    return () => {
      // ここでは destroy しない。コンポーネントが完全に消えるまで維持する。
    };
  }, []); // 空の依存配列で、マウント時に1回だけ初期化

  // videoId が変わった際の処理
  useEffect(() => {
    if (playerRef.current && isReadyRef.current) {
      playerRef.current.loadVideoById(videoId);
    }
  }, [videoId]);

  // コンポーネントが完全にアンマウントされる時だけ破棄
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          // ignore
        }
        playerRef.current = null;
        isReadyRef.current = false;
      }
    };
  }, []);

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

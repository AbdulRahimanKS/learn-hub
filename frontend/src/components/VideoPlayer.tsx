import React, { useEffect, useRef } from 'react';
// @ts-ignore: plyr default export typings conflict in strict ESM
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';

interface VideoPlayerProps {
  url: string;
  poster?: string;
}

export function VideoPlayer({ url, poster }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Plyr>();
  const [isReady, setIsReady] = React.useState(false);

  useEffect(() => {
    if (!videoRef.current) return;

    // Use a small timeout to ensure DOM is ready and styles are applied
    const initTimer = setTimeout(() => {
      if (!videoRef.current) return;

      const player = new Plyr(videoRef.current, {
        autoplay: true,
        ratio: '16:9',
        controls: [
          'play-large', 'play', 'progress', 'current-time', 'duration', 
          'mute', 'volume', 'settings', 'pip', 'airplay', 'fullscreen'
        ],
        settings: ['quality', 'speed', 'loop'],
        invertTime: false,
        toggleInvert: true,
      });
      
      player.on('ready', () => {
        setIsReady(true);
        // Force a layout recalculation
        window.dispatchEvent(new Event('resize'));
      });

      playerRef.current = player;
    }, 50);

    return () => {
      clearTimeout(initTimer);
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.error("Error destroying Plyr instance:", e);
        }
      }
    };
  }, [url]);

  return (
    <div 
      className={`w-full h-full bg-black rounded-xl overflow-hidden shadow-2xl relative transition-opacity duration-300 ${isReady ? 'opacity-100' : 'opacity-0'}`} 
      style={{ 
        '--plyr-color-main': 'hsl(var(--primary))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      } as React.CSSProperties}
    >
      <video
        ref={videoRef}
        playsInline
        controlsList="nodownload"
        poster={poster}
        className="w-full h-full"
      >
        <source src={url} type="video/mp4" />
      </video>
      
      {/* Fallback styling to ensure controls stay down even if Plyr glitches */}
      <style>{`
        .plyr--video .plyr__controls {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 10;
        }
        .plyr--video.plyr--hide-controls .plyr__controls {
          transform: translateY(100%);
          opacity: 0;
        }
        .plyr--video {
          height: 100% !important;
          width: 100% !important;
          max-width: 100% !important;
        }
      `}</style>
    </div>
  );
}

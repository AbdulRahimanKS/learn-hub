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

  useEffect(() => {
    if (!videoRef.current) return;

    // We initialize Plyr manually on the video element, this is rock solid 
    // and doesn't conflict with React 18 strict mode unmounting
    const player = new Plyr(videoRef.current, {
      autoplay: true,
      controls: [
        'play-large', 'play', 'progress', 'current-time', 'duration', 
        'mute', 'volume', 'settings', 'pip', 'airplay', 'fullscreen'
      ],
      settings: ['quality', 'speed', 'loop'],
      invertTime: false,
      toggleInvert: true,
    });
    
    playerRef.current = player;

    return () => {
      // Clean up player cleanly on unmount
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.error("Error destroying Plyr instance:", e);
        }
      }
    };
  }, [url]); // Intentionally omitting poster to avoid recreation on poster change

  return (
    <div className="w-full h-full bg-black rounded-xl overflow-hidden shadow-2xl relative" style={{ '--plyr-color-main': 'hsl(var(--primary))' } as React.CSSProperties}>
      <video
        ref={videoRef}
        playsInline
        controlsList="nodownload"
        poster={poster}
        className="w-full h-full object-contain"
      >
        <source src={url} type="video/mp4" />
      </video>
    </div>
  );
}

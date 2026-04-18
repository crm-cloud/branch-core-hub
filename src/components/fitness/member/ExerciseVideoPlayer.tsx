import { useEffect, useRef, useState } from 'react';
import { Play, ExternalLink } from 'lucide-react';

interface ExerciseVideoPlayerProps {
  url: string;
  title?: string;
}

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function vimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

/**
 * Plays an exercise form / meal prep video.
 *  - Self-hosted MP4/WebM/MOV → HTML5 <video> with playbackRate=0.75 + loop + autoplay (muted)
 *  - YouTube → iframe with rel=0&loop=1&playlist=<id>&playsinline=1
 *  - Vimeo → iframe with loop=1&autoplay=1
 *
 * 0.75x slow-motion playback is supported natively for HTML5 videos. Most
 * embedded YouTube/Vimeo players don't allow setting playback rate via URL,
 * so we still loop + autoplay them but the user can change speed in the
 * provider's UI.
 */
export function ExerciseVideoPlayer({ url, title }: ExerciseVideoPlayerProps) {
  const [open, setOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (open && videoRef.current) {
      try {
        videoRef.current.playbackRate = 0.75;
      } catch {
        // ignore
      }
    }
  }, [open]);

  if (!url) return null;
  const yt = youtubeId(url);
  const vm = vimeoId(url);
  const isFile = !yt && !vm && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative aspect-video w-full overflow-hidden rounded-md border bg-muted/40 flex items-center justify-center"
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-background/90 group-hover:bg-background rounded-full p-3 shadow-md transition-all">
            <Play className="h-6 w-6 text-accent" />
          </div>
        </div>
        <span className="absolute bottom-2 left-2 text-xs bg-background/80 px-2 py-0.5 rounded">
          {title || 'Form video'} · 0.75×
        </span>
      </button>
    );
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-md border bg-black">
      {isFile ? (
        <video
          ref={videoRef}
          src={url}
          autoPlay
          loop
          muted
          controls
          playsInline
          className="w-full h-full"
        />
      ) : yt ? (
        <iframe
          title={title || 'Form video'}
          src={`https://www.youtube.com/embed/${yt}?autoplay=1&loop=1&mute=1&playlist=${yt}&rel=0&playsinline=1`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
        />
      ) : vm ? (
        <iframe
          title={title || 'Form video'}
          src={`https://player.vimeo.com/video/${vm}?autoplay=1&loop=1&muted=1`}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
        />
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center w-full h-full text-sm text-muted-foreground gap-2"
        >
          <ExternalLink className="h-4 w-4" /> Open video
        </a>
      )}
    </div>
  );
}

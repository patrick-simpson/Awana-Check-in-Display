import { useEffect, useState } from 'react';
import { BACKGROUND_VIDEO_ID, getVideo } from '../lib/videoStore.js';

/**
 * Full-screen looping video background (#25). One video, uploaded in
 * Settings → Background, stored in THIS device's IndexedDB (never uploaded
 * anywhere) under the single well-known background slot.
 *
 * Rules it must never break:
 *   • muted + playsInline always — a kiosk reload has no user gesture, and
 *     an autoplay block would freeze the whole background;
 *   • never wedge: no stored video, a decode error, or blocked IndexedDB
 *     all fall back to the caller-provided placeholder scene;
 *   • the object URL is revoked on unmount so replacing the video doesn't
 *     leak the old multi-megabyte blob.
 */
export default function VideoBackground({ fallback = null }) {
  const [url, setUrl] = useState(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    let live = true;
    let objectUrl = null;
    getVideo(BACKGROUND_VIDEO_ID).then((blob) => {
      if (!live) return;
      if (!blob) {
        setBroken(true);
        return;
      }
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      live = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  if (broken || !url) return fallback;

  return (
    <video
      className="background-video"
      src={url}
      autoPlay
      muted
      loop
      playsInline
      disablePictureInPicture
      // Decode failure (unsupported codec, corrupt file): show the
      // placeholder rather than a black screen with a broken-video glyph.
      onError={() => setBroken(true)}
    />
  );
}

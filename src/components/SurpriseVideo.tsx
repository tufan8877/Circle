import {forwardRef, useEffect, useImperativeHandle, useRef, useState} from 'react';
import {useLanguage} from '@/lib/i18n';

export interface SurpriseVideoHandle {play: () => void}
const SurpriseVideo = forwardRef<SurpriseVideoHandle>(function SurpriseVideo(_, ref) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);
  const {language} = useLanguage();
  const close = () => {
    videoRef.current?.pause();
    dialogRef.current?.close();
  };
  useImperativeHandle(ref, () => ({
    play: () => {
      const dialog = dialogRef.current, video = videoRef.current;
      if (!dialog || !video) return;
      setBlocked(false);
      // Called synchronously by the fifth pointer-up handler. Do not move
      // play() into an effect/timer: that can lose transient user activation.
      if (!dialog.open) dialog.showModal();
      video.muted = false;
      video.volume = 1;
      video.currentTime = 0;
      void video.play().catch(() => setBlocked(true));
    },
  }), []);
  useEffect(() => () => {videoRef.current?.pause();}, []);
  return (
    <dialog ref={dialogRef} onCancel={close} aria-label="Video" className="fixed inset-0 m-auto h-[100dvh] max-h-none w-screen max-w-none border-0 bg-black p-0 text-white backdrop:bg-black">
      <video ref={videoRef} src="/scary.mp4" playsInline preload="auto" onEnded={close} onError={close} className="h-full w-full object-contain" />
      <button type="button" onClick={close} className="absolute right-4 top-4 rounded-xl bg-black/70 px-4 py-3 text-sm text-white" style={{top: 'max(1rem, env(safe-area-inset-top))'}}>{language === 'de' ? 'Schließen' : 'Close'}</button>
      {blocked && <p role="alert" className="absolute inset-x-4 top-1/2 rounded-xl bg-black/80 p-4 text-center">{language === 'de' ? 'Der Browser hat die automatische Wiedergabe mit Ton blockiert.' : 'The browser blocked automatic playback with sound.'}</p>}
    </dialog>
  );
});
export default SurpriseVideo;

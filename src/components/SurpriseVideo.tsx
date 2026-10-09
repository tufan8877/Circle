import {forwardRef, useEffect, useImperativeHandle, useRef} from 'react';
import {useLanguage} from '@/lib/i18n';
import {SurpriseAudio} from '@/lib/surpriseAudio';
import {markSurpriseShown} from '@/lib/surprise';

export interface SurpriseVideoHandle {play: () => void; unlockAudio: () => void}
const SurpriseVideo = forwardRef<SurpriseVideoHandle>(function SurpriseVideo(_, ref) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef(new SurpriseAudio());
  const separateAudio = useRef(false);
  const audioStarted = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const {language} = useLanguage();
  const close = () => {
    clearTimeout(timeoutRef.current);
    audioRef.current.stop();
    videoRef.current?.pause();
    dialogRef.current?.close();
  };
  useImperativeHandle(ref, () => ({
    unlockAudio: () => audioRef.current.unlock(),
    play: () => {
      const dialog = dialogRef.current, video = videoRef.current;
      if (!dialog || !video) return;
      audioStarted.current = false;
      separateAudio.current = audioRef.current.ready;
      // Prepared Web Audio supplies sound; the video itself stays muted.
      // Fall back to native sound if preparation was unavailable.
      video.muted = separateAudio.current;
      video.volume = 1;
      video.currentTime = 0;
      if (!dialog.open) dialog.showModal();
      timeoutRef.current = setTimeout(close, 4000);
      void video.play().catch(error => {
        console.warn('Surprise video playback failed', error);
        close();
      });
    },
  }), []);
  useEffect(() => {
    const audio = audioRef.current;
    const video = videoRef.current;
    // iOS also recognizes touchend/click after the first drawing gesture.
    const unlock = () => {if (!dialogRef.current?.open) audio.unlock();};
    document.addEventListener('touchend', unlock, {capture: true, passive: true});
    document.addEventListener('click', unlock, true);
    return () => {
      document.removeEventListener('touchend', unlock, true);
      document.removeEventListener('click', unlock, true);
      clearTimeout(timeoutRef.current);
      video?.pause();
      audio.dispose();
    };
  }, []);
  return (
    <dialog ref={dialogRef} onCancel={close} aria-label="Video" className="fixed inset-0 m-auto h-[100dvh] max-h-none w-screen max-w-none border-0 bg-black p-0 text-white backdrop:bg-black">
      <video ref={videoRef} src="/scary.mp4" playsInline preload="auto" muted
        onPlaying={() => {
          markSurpriseShown();
          clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(close, 4000);
          if (separateAudio.current && !audioStarted.current) {
            audioStarted.current = audioRef.current.play(videoRef.current?.currentTime ?? 0);
          }
        }}
        onPause={() => audioRef.current.stop()}
        onEnded={close} onError={close} className="h-full w-full object-contain" />
      <button type="button" onClick={close} className="absolute right-4 top-4 rounded-xl bg-black/70 px-4 py-3 text-sm text-white" style={{top: 'max(1rem, env(safe-area-inset-top))'}}>{language === 'de' ? 'Schließen' : 'Close'}</button>
    </dialog>
  );
});
export default SurpriseVideo;

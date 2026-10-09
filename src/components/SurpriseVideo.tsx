import {forwardRef, useEffect, useImperativeHandle, useRef} from 'react';
import {useLanguage} from '@/lib/i18n';
import {SurpriseAudio} from '@/lib/surpriseAudio';
import {markSurpriseShown} from '@/lib/surprise';

export interface SurpriseVideoHandle {play: () => void; unlockAudio: () => void}
const SurpriseVideo = forwardRef<SurpriseVideoHandle>(function SurpriseVideo(_, ref) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef(new SurpriseAudio());
  const framesRef = useRef<HTMLImageElement | null>(null);
  const pendingRef = useRef(false);
  const animationRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const startRef = useRef<() => void>(() => {});
  const {language} = useLanguage();
  const close = () => {
    pendingRef.current = false;
    clearTimeout(timeoutRef.current);
    cancelAnimationFrame(animationRef.current);
    audioRef.current.stop();
    dialogRef.current?.close();
  };
  startRef.current = () => {
    const dialog = dialogRef.current, canvas = canvasRef.current, frames = framesRef.current;
    if (!pendingRef.current || !dialog || !canvas || !frames) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) {close(); return;}
    pendingRef.current = false;
    clearTimeout(timeoutRef.current);
    if (!dialog.open) dialog.showModal();
    // Render the supplied video's 30 frames directly. This avoids video.play()
    // restrictions (including iOS Low Power Mode) without showing a play button.
    const paint = (frame: number) => ctx.drawImage(frames,
      (frame % 5) * 512, Math.floor(frame / 5) * 910, 512, 910,
      0, 0, 512, 910);
    paint(0);
    markSurpriseShown();
    audioRef.current.play();
    const started = performance.now();
    let lastFrame = 0;
    const tick = (now: number) => {
      const elapsed = now - started;
      if (elapsed >= 1000) {close(); return;}
      const frame = Math.min(29, Math.floor(elapsed * 30 / 1000));
      if (frame !== lastFrame) {paint(frame); lastFrame = frame;}
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
    timeoutRef.current = setTimeout(close, 1500);
  };
  useImperativeHandle(ref, () => ({
    unlockAudio: () => audioRef.current.unlock(),
    play: () => {
      if (pendingRef.current || dialogRef.current?.open) return;
      pendingRef.current = true;
      // If loading is slow, wait for actual frames before displaying anything.
      timeoutRef.current = setTimeout(close, 15000);
      startRef.current();
    },
  }), []);
  useEffect(() => {
    const audio = audioRef.current;
    const image = new Image();
    image.onload = () => {
      framesRef.current = image;
      startRef.current();
    };
    image.onerror = () => {console.warn('Surprise frames failed to load'); close();};
    image.src = '/scary-frames.jpg';
    const unlock = () => {if (!dialogRef.current?.open) audio.unlock();};
    const visibility = () => {if (document.hidden) close();};
    document.addEventListener('touchend', unlock, {capture: true, passive: true});
    document.addEventListener('click', unlock, true);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      image.onload = null;
      image.onerror = null;
      document.removeEventListener('touchend', unlock, true);
      document.removeEventListener('click', unlock, true);
      document.removeEventListener('visibilitychange', visibility);
      close();
      framesRef.current = null;
      audio.dispose();
    };
  }, []);
  return (
    <dialog ref={dialogRef} onCancel={close} aria-label="Video" className="fixed inset-0 m-auto h-[100dvh] max-h-none w-screen max-w-none border-0 bg-black p-0 text-white backdrop:bg-black">
      <div className="flex h-full w-full items-center justify-center">
        <canvas ref={canvasRef} width={512} height={910} aria-label={language === 'de' ? 'Überraschungsvideo' : 'Surprise video'} style={{height: '100%', width: 'auto', maxWidth: '100%', objectFit: 'contain'}} />
      </div>
      <button type="button" onClick={close} className="absolute right-4 top-4 rounded-xl bg-black/70 px-4 py-3 text-sm text-white" style={{top: 'max(1rem, env(safe-area-inset-top))'}}>{language === 'de' ? 'Schließen' : 'Close'}</button>
    </dialog>
  );
});
export default SurpriseVideo;

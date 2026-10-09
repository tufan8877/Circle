import {useEffect, useRef, useState} from 'react';
import {useLanguage} from '@/lib/i18n';

export default function SurpriseVideo({open, onClose}: {open: boolean; onClose: () => void}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [needsPlay, setNeedsPlay] = useState(false);
  const {language} = useLanguage();
  useEffect(() => {
    const dialog = dialogRef.current, video = videoRef.current;
    if (!dialog || !video) return;
    let disposed = false;
    if (!open) {
      video.pause();
      if (dialog.open) dialog.close();
      return;
    }
    setNeedsPlay(false);
    if (!dialog.open) dialog.showModal();
    video.currentTime = 0;
    video.muted = false;
    const play = async () => {
      try { await video.play(); }
      catch {
        if (disposed) return;
        // Mobile browsers may block automatic sound after drawing.
        video.muted = true;
        try { await video.play(); }
        catch { if (!disposed) setNeedsPlay(true); }
      }
    };
    void play();
    return () => {disposed = true; video.pause(); if (dialog.open) dialog.close();};
  }, [open]);
  return (
    <dialog ref={dialogRef} onCancel={onClose} aria-label={language === 'de' ? 'Video' : 'Video'} className="fixed inset-0 m-auto h-[100dvh] max-h-none w-screen max-w-none border-0 bg-black p-0 text-white backdrop:bg-black">
      <video ref={videoRef} src="/scary.mp4" playsInline preload="auto" onEnded={onClose} onError={onClose} className="h-full w-full object-contain" />
      <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-xl bg-black/70 px-4 py-3 text-sm text-white" style={{top: 'max(1rem, env(safe-area-inset-top))'}}>{language === 'de' ? 'Schließen' : 'Close'}</button>
      {needsPlay && <button type="button" onClick={() => {const video = videoRef.current; if (video) {video.muted = false; void video.play().then(() => setNeedsPlay(false)).catch(() => {});}}} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white px-6 py-3 font-semibold text-black">{language === 'de' ? 'Video abspielen' : 'Play video'}</button>}
    </dialog>
  );
}

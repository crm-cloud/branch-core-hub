import { useEffect, useRef, useCallback } from 'react';

const STORAGE_KEY = 'incline:chat-sound-enabled';

export function isChatSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const v = localStorage.getItem(STORAGE_KEY);
  return v === null ? true : v === 'true';
}

export function setChatSoundEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, String(enabled));
  window.dispatchEvent(new CustomEvent('chat-sound-pref-change'));
}

/**
 * Lightweight inline notification sound (WebAudio synthesized "ping").
 * Avoids shipping an audio file and works offline.
 */
function playPing() {
  try {
    const AudioCtx =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.32);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    setTimeout(() => ctx.close().catch(() => {}), 500);
  } catch {
    // ignore
  }
}

/**
 * Plays a notification sound when `trigger` value increases (e.g. unread count).
 * Respects the user's chat-sound preference.
 */
export function useChatSound(trigger: number) {
  const prev = useRef(trigger);

  useEffect(() => {
    if (trigger > prev.current && isChatSoundEnabled()) {
      playPing();
    }
    prev.current = trigger;
  }, [trigger]);
}

export function useChatSoundPreference() {
  const get = useCallback(isChatSoundEnabled, []);
  const set = useCallback(setChatSoundEnabled, []);
  return { get, set };
}

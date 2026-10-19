import { useCallback, useEffect, useRef, useState } from 'react';

import { BEEPS, VIBRATION, readFeedbackPrefs, saveFeedbackPrefs, type FeedbackPrefs, type FeedbackTone } from '@/lib/staff-portal';

const storage = () => { try { return window.localStorage; } catch { return null; } };

/**
 * Gate feedback in addition to the written verdict: a short beep pattern and a vibration per tone.
 * Both are optional, remembered per account in this browser, and never replace the words on screen.
 * The AudioContext is created on the first scan (a user gesture), as browsers require.
 */
export function useScanFeedback(accountId: number) {
  const [prefs, setPrefs] = useState<FeedbackPrefs>(() => readFeedbackPrefs(accountId, storage()));
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => () => { void audioRef.current?.close().catch(() => {}); }, []);

  const update = useCallback((next: Partial<FeedbackPrefs>) => {
    setPrefs((current) => {
      const merged = { ...current, ...next };
      saveFeedbackPrefs(accountId, merged, storage());
      return merged;
    });
  }, [accountId]);

  /** Must be called from a click/keypress handler once so the browser allows sound later. */
  const unlock = useCallback(() => {
    if (!prefs.sound || audioRef.current) return;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) audioRef.current = new Ctor();
    } catch { /* no audio: the written verdict still shows */ }
  }, [prefs.sound]);

  const play = useCallback((tone: FeedbackTone) => {
    if (prefs.vibrate && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(VIBRATION[tone]); } catch { /* unsupported */ }
    }
    if (!prefs.sound) return;
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (audio.state === 'suspended') void audio.resume();
      let at = audio.currentTime + 0.01;
      for (const [frequency, duration] of BEEPS[tone]) {
        if (frequency > 0) {
          const osc = audio.createOscillator();
          const gain = audio.createGain();
          osc.type = 'square';
          osc.frequency.value = frequency;
          gain.gain.setValueAtTime(0.0001, at);
          gain.gain.exponentialRampToValueAtTime(0.18, at + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, at + duration / 1000);
          osc.connect(gain).connect(audio.destination);
          osc.start(at);
          osc.stop(at + duration / 1000 + 0.02);
        }
        at += duration / 1000;
      }
    } catch { /* ignore audio errors */ }
  }, [prefs.sound, prefs.vibrate]);

  const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  return { prefs, update, unlock, play, canVibrate };
}

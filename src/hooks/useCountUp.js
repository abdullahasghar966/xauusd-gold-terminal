import { useEffect, useRef } from 'react';

/**
 * Animates a numeric value to `target` using setInterval (resilient to
 * environments where requestAnimationFrame is throttled/paused).
 * First mount tweens from 0; subsequent target changes tween from the
 * current displayed value so live-tick updates don't snap back to zero.
 */
export function useCountUp(target, { delay = 0, duration = 1.0, format = (v) => v.toFixed(2) } = {}) {
  const ref = useRef(null);
  const stateRef = useRef({ v: 0, mounted: false });
  const fmtRef = useRef(format);
  fmtRef.current = format;

  useEffect(() => {
    if (!ref.current) return;
    if (!Number.isFinite(target)) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      stateRef.current.v = target;
      ref.current.textContent = fmtRef.current(target);
      stateRef.current.mounted = true;
      return;
    }

    const from = stateRef.current.mounted ? stateRef.current.v : 0;
    const dur = (stateRef.current.mounted ? 0.6 : duration) * 1000;
    const useDelay = (stateRef.current.mounted ? 0 : delay) * 1000;
    stateRef.current.mounted = true;

    const startAt = Date.now() + useDelay;
    const ease = (t) => 1 - Math.pow(1 - t, 3);

    const id = setInterval(() => {
      const elapsed = Date.now() - startAt;
      if (elapsed < 0) return;
      const p = Math.min(1, elapsed / Math.max(1, dur));
      const v = from + (target - from) * ease(p);
      stateRef.current.v = v;
      if (ref.current) ref.current.textContent = fmtRef.current(v);
      if (p >= 1) clearInterval(id);
    }, 16);

    return () => clearInterval(id);
  }, [target, delay, duration]);

  return ref;
}

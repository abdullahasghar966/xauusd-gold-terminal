import { useEffect } from 'react';
import gsap from 'gsap';

/**
 * Orchestrated entrance sequence per the master prompt.
 * All tweens use `immediateRender: false` so if the GSAP/RAF ticker is
 * paused (e.g. background tab, headless renderers), elements remain at
 * their natural visible state instead of locking to the FROM state.
 */
export function useEntranceTimeline(ready) {
  useEffect(() => {
    if (!ready) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const tl = gsap.timeline({ defaults: { ease: 'power3.out', immediateRender: false } });

    tl.from('[data-anim="grid"]',
      { scaleY: 0, transformOrigin: '50% 50%', autoAlpha: 0, duration: 0.6 }, 0);

    tl.from('[data-anim="header"]',
      { y: -18, autoAlpha: 0, duration: 0.6 }, 0.15);

    tl.from('[data-anim="kpi"]',
      { y: 28, autoAlpha: 0, duration: 0.55, stagger: 0.1 }, 0.3);

    tl.from('[data-anim="primary-chart"]',
      { y: 28, autoAlpha: 0, duration: 0.55 }, 0.55);

    tl.from('[data-anim="secondary"]',
      { y: 28, autoAlpha: 0, duration: 0.5, stagger: 0.08 }, 0.9);

    tl.from('[data-anim="tertiary"]',
      { y: 22, autoAlpha: 0, duration: 0.5, stagger: 0.08 }, 1.05);

    tl.from('[data-anim="tail"]',
      { y: 18, autoAlpha: 0, duration: 0.45, stagger: 0.06 }, 1.25);

    return () => tl.kill();
  }, [ready]);
}

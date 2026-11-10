import { useLayoutEffect } from 'react';

/** Reset after a screen commits, including content revealed by Suspense. */
export function useScreenScrollStart(screenKey: string) {
  useLayoutEffect(() => {
    const reset = () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    reset();
    const frame = window.requestAnimationFrame(reset);
    return () => window.cancelAnimationFrame(frame);
  }, [screenKey]);
}

export function ScreenScrollStart({ screenKey }: { screenKey: string }) {
  useScreenScrollStart(screenKey);
  return null;
}

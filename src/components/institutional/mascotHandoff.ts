import { useMemo } from 'react';
import { useMotionValue, type MotionValue } from 'motion/react';

export interface MascotHandoff {
  progress: MotionValue<number>;
  targetX: MotionValue<number>;
  targetY: MotionValue<number>;
}

/** Shared scroll coordinates; no React renders are scheduled while scrolling. */
export function useMascotHandoff(): MascotHandoff {
  const progress = useMotionValue(0);
  const targetX = useMotionValue(0);
  const targetY = useMotionValue(0);
  return useMemo(() => ({ progress, targetX, targetY }), [progress, targetX, targetY]);
}

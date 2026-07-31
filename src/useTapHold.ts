import { useCallback, useEffect, useRef } from 'react';

// Tap to act, hold to reveal. Used by the habit card: a tap marks the period
// done, a hold opens the cog tray.
//
// The movement threshold is the whole point. DayCircle has carried a plain hold
// timer with no move cancel since it was written, which is survivable on a 30px
// circle you have to aim at. A habit card is the full width of a list that
// scrolls vertically and sits inside a carousel that swipes horizontally, so
// without this every other scroll would pop a tray open.
//
// Tap rides on click rather than pointerup on purpose: browsers already suppress
// click when a touch turns into a scroll, and it keeps the keyboard working, so
// Enter and Space on the host button behave like a tap for free.

/** How long a press must last before it counts as a hold. */
export const HOLD_MS = 500;
/** How far a pointer may wander before the press stops counting as a press. */
export const HOLD_SLOP_PX = 10;

export interface TapHoldHandlers {
  onClick: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onPointerLeave: () => void;
  onContextMenu: (e: React.SyntheticEvent) => void;
}

export function useTapHold(onTap: () => void, onHold: () => void): TapHoldHandlers {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const held = useRef(false);

  const cancel = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  }, []);
  useEffect(() => cancel, [cancel]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    held.current = false; // a release outside the card must not eat the next tap
    origin.current = { x: e.clientX, y: e.clientY };
    cancel();
    timer.current = setTimeout(() => {
      timer.current = null;
      held.current = true;
      onHold();
    }, HOLD_MS);
  }, [cancel, onHold]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!timer.current) return;
    const dx = e.clientX - origin.current.x;
    const dy = e.clientY - origin.current.y;
    // Squared distance, so no square root for something checked on every move.
    if (dx * dx + dy * dy > HOLD_SLOP_PX * HOLD_SLOP_PX) cancel();
  }, [cancel]);

  const onClick = useCallback(() => {
    if (held.current) { held.current = false; return; } // the hold already acted
    onTap();
  }, [onTap]);

  // A long press on touch would otherwise raise the selection callout.
  const onContextMenu = useCallback((e: React.SyntheticEvent) => e.preventDefault(), []);

  return {
    onClick, onPointerDown, onPointerMove, onContextMenu,
    onPointerUp: cancel, onPointerCancel: cancel, onPointerLeave: cancel,
  };
}

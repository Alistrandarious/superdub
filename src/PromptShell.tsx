import React, { useEffect, useRef } from 'react';
import './App.css';
import { pageTheme } from './theme';

// Full-screen prompt overlay — the shared shell every daily prompt renders inside.
// Replaces the 480px `.checkin-modal` bottom sheet with a full-bleed moment:
// accent top-glow, mono eyebrow, big Kanit-italic title, the input control in the
// middle, a bottom-pinned primary CTA and a quiet "Not now" dismiss.
//
// v1 has NO mascot — the `mascot` slot is reserved and renders only if provided
// (the Dub is being redesigned separately). The hero is carried by glow + title.
//
// Presentational only: it owns layout, the accent theme, focus, Escape and the
// optional backdrop dismiss. All state lives in the prompt component that wraps it.

export interface PromptShellCta {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface PromptShellProps {
  /** Semantic accent from theme.ts (HEALTH / TEAL / GROWTH / GOLD …). Sets --theme via pageTheme. */
  accent: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** The reviewed input control (weight stepper, sliders, pills …). */
  children?: React.ReactNode;
  /** Primary button. Optional — some prompts (e.g. Quick log) have no single CTA. */
  cta?: PromptShellCta;
  onDismiss: () => void;
  dismissLabel?: string;
  /** Decorative art beside the title (e.g. GlobalPrompt's planet). */
  art?: React.ReactNode;
  /** RESERVED for the redesigned Dub — renders only if provided. Empty in v1. */
  mascot?: React.ReactNode;
  /** Close when the void behind the content is tapped (GlobalPrompt behaviour). */
  closeOnBackdrop?: boolean;
}

const PromptShell: React.FC<PromptShellProps> = ({
  accent,
  eyebrow,
  title,
  subtitle,
  children,
  cta,
  onDismiss,
  dismissLabel = 'Not now',
  art,
  mascot,
  closeOnBackdrop = false,
}) => {
  const ctaRef = useRef<HTMLButtonElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);

  // Move focus into the dialog on mount: the CTA if there is one, otherwise the
  // panel itself (tabIndex -1) so the screen reader lands on the title.
  useEffect(() => {
    (ctaRef.current ?? screenRef.current)?.focus();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onDismiss();
    }
  };

  // Only a click that lands on the root void (not the content) is a backdrop tap.
  const onBackdrop = (e: React.MouseEvent) => {
    if (closeOnBackdrop && e.target === e.currentTarget) onDismiss();
  };

  return (
    <div
      className="prompt-fs"
      style={pageTheme(accent, '2E')}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onKeyDown={onKeyDown}
      onClick={onBackdrop}
    >
      <div className="prompt-fs-glow" aria-hidden="true" />
      <div className="prompt-fs-motes" aria-hidden="true">
        <i /><i /><i /><i /><i /><i />
      </div>

      <div className="prompt-fs-screen" ref={screenRef} tabIndex={-1}>
        {/* Always-there way out, pinned to the top corner. The bottom dismiss can be
            scrolled off on a short screen; this one never is. */}
        <button className="prompt-fs-close" onClick={onDismiss} aria-label="Close">✕</button>
        <div className="prompt-fs-hero">
          {eyebrow && <span className="prompt-fs-eyebrow">{eyebrow}</span>}
          {mascot && <div className="prompt-fs-mascot">{mascot}</div>}
          {art && <div className="prompt-fs-art">{art}</div>}
          <h2 className="prompt-fs-title">{title}</h2>
          {subtitle && <p className="prompt-fs-sub">{subtitle}</p>}
        </div>

        {children != null && <div className="prompt-fs-body">{children}</div>}

        <div className="prompt-fs-fill" />

        <div className="prompt-fs-actions">
          {cta && (
            <button
              ref={ctaRef}
              className="prompt-fs-cta"
              onClick={cta.onClick}
              disabled={cta.disabled}
            >
              {cta.label}
            </button>
          )}
          <button className="prompt-fs-dismiss" onClick={onDismiss}>
            {dismissLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromptShell;

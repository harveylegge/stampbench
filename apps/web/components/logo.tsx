/**
 * The Stampbench mark: an S built from two interlocking staple shapes, from
 * the 2026-08 brand board. The top staple is always brand purple; the bottom
 * one inherits `currentColor`, so the same component works on light surfaces
 * (ink bottom, like the board's light variant) and dark ones (white bottom)
 * with no props. Keep this file the single source of the mark — the favicon
 * (app/icon.svg) and the schema logo PNG are derived from the same geometry.
 */

const PURPLE_FROM = '#7B57F6';
const PURPLE_TO = '#5B2BD6';

export function StampbenchMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      className={className}
    >
      <defs>
        <linearGradient id="sb-mark-purple" x1="13" y1="13" x2="51" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor={PURPLE_FROM} />
          <stop offset="1" stopColor={PURPLE_TO} />
        </linearGradient>
      </defs>
      {/* top staple */}
      <path
        d="M52 25 V19 Q52 13 46 13 H18 Q12 13 12 19 V31 Q12 37 18 37 H40"
        stroke="url(#sb-mark-purple)"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* bottom staple — inherits the surrounding text colour */}
      <path
        d="M12 39 V45 Q12 51 18 51 H46 Q52 51 52 45 V33 Q52 27 46 27 H24"
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Market flags, drawn rather than typed.
 *
 * Emoji flags (🇬🇧, 🇺🇸) are the obvious choice and the wrong one: Chrome on
 * Windows has no flag glyphs and renders the underlying regional-indicator
 * letters instead, so a large share of visitors would see "GB" and "US" in a
 * box where the design expects a flag. These are ~500 bytes of inline SVG that
 * look identical everywhere, scale cleanly, and match the restrained style of
 * the rest of the site.
 *
 * Simplified on purpose at icon size: no stars on the US canton, no offset on
 * the Union Flag's saltire. Both are illegible below ~32px anyway and the
 * detail only adds noise.
 */
export type FlagCode = 'gb' | 'us' | 'eu' | 'de' | 'globe';

/** 12 stars on a circle — the arrangement is the whole identity of the EU flag. */
const EU_STARS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i * Math.PI) / 6 - Math.PI / 2;
  return {
    cx: +(10 + 4.1 * Math.cos(angle)).toFixed(2),
    cy: +(7 + 4.1 * Math.sin(angle)).toFixed(2),
  };
});

export function Flag({ code, size = 22, className = '' }: { code: FlagCode; size?: number; className?: string }) {
  // The clip is a CSS box on the rendered element, so the radius has to be in
  // CSS pixels rather than viewBox units — otherwise a 40px flag gets the same
  // 2.5px corner as an 18px one and looks squarer the bigger it grows.
  const radius = (size * 2.5) / 20;
  return (
    <svg
      width={size}
      height={(size * 14) / 20}
      viewBox="0 0 20 14"
      className={`shrink-0 ${className}`}
      /* Rounded corners via CSS on the root <svg> rather than an SVG
         <clipPath>. A clipPath needs an id, and the same flag appears more
         than once on /markets (column header and card), which would put
         duplicate ids in the document — invalid, and the kind of thing that
         quietly confuses accessibility tooling. inset() needs no id at all. */
      style={{ clipPath: `inset(0 round ${radius}px)` }}
      aria-hidden
      focusable="false"
    >
      <g>
        {code === 'gb' && (
          <>
            <rect width="20" height="14" fill="#012169" />
            <path d="M0 0 20 14M20 0 0 14" stroke="#fff" strokeWidth="3.2" />
            <path d="M0 0 20 14M20 0 0 14" stroke="#C8102E" strokeWidth="1.4" />
            <path d="M10 0V14M0 7H20" stroke="#fff" strokeWidth="4.2" />
            <path d="M10 0V14M0 7H20" stroke="#C8102E" strokeWidth="2.4" />
          </>
        )}

        {code === 'us' && (
          <>
            <rect width="20" height="14" fill="#fff" />
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <rect key={i} y={(i * 28) / 13} width="20" height={14 / 13} fill="#B31942" />
            ))}
            <rect width="8.8" height={(14 / 13) * 7} fill="#0A3161" />
          </>
        )}

        {code === 'eu' && (
          <>
            <rect width="20" height="14" fill="#039" />
            {EU_STARS.map((s) => (
              <circle key={`${s.cx}-${s.cy}`} cx={s.cx} cy={s.cy} r="0.75" fill="#FC0" />
            ))}
          </>
        )}

        {code === 'de' && (
          <>
            <rect width="20" height="14" fill="#000" />
            <rect y="4.667" width="20" height="4.667" fill="#D00" />
            <rect y="9.333" width="20" height="4.667" fill="#FFCE00" />
          </>
        )}

        {code === 'globe' && (
          <>
            <rect width="20" height="14" fill="currentColor" opacity="0.08" />
            <g stroke="currentColor" strokeWidth="0.85" fill="none" opacity="0.6">
              <circle cx="10" cy="7" r="4.6" />
              <path d="M10 2.4v9.2M5.4 7h9.2" />
              <ellipse cx="10" cy="7" rx="2.2" ry="4.6" />
            </g>
          </>
        )}
      </g>
      {/* Hairline frame, inset by half its own width so the clip above does
          not shave the outer half of the stroke off. */}
      <rect
        x="0.4"
        y="0.4"
        width="19.2"
        height="13.2"
        rx="2.1"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.18"
        strokeWidth="0.8"
      />
    </svg>
  );
}

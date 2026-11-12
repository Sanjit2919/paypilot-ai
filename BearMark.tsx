/**
 * PayPilot brand mark — interlocking dual-wing "P" monogram with an orbital
 * flight arc and north-star beacon. Driven by `currentColor` so it adapts to
 * both the blue brand tile and the cream orbit centre.
 */
export function BearMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      {/* Secondary offset wing (depth layer) */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15.5 39L24.2 14.6C25.1 12.1 27.5 10.5 30.2 10.5H38.2C41.4 10.5 43.6 13.7 42.5 16.7L39.9 23.8C38.8 26.8 36 28.8 32.8 28.8H25.4L21.7 39H15.5ZM27.4 23.2H32.1C33.4 23.2 34.6 22.4 35.1 21.1L36.5 17.2C36.8 16.4 36.2 15.6 35.4 15.6H29.8C28.8 15.6 27.9 16.2 27.5 17.2L25.4 23.2H27.4Z"
        fill="currentColor"
        fillOpacity="0.32"
      />
      {/* Primary sculpted "P" wing */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.5 36.5L17.8 10.8C18.8 8.1 21.4 6.3 24.3 6.3H33.4C36.9 6.3 39.3 9.8 38.1 13.1L35.2 21C34 24.3 30.9 26.5 27.4 26.5H19.4L15.7 36.5H8.5ZM21.4 20.4H26.8C28.3 20.4 29.6 19.5 30.1 18.1L31.7 13.7C32 12.8 31.4 11.9 30.4 11.9H24.3C23.1 11.9 22.1 12.6 21.7 13.7L19.3 20.4H21.4Z"
        fill="currentColor"
      />
      {/* Orbital flight arc + satellite nodes */}
      <path
        d="M8 41.2C18.8 44.2 32.4 40.4 40.4 31"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="41.2" cy="29.2" r="2.5" fill="currentColor" />
      <circle cx="8" cy="41.2" r="1.6" fill="currentColor" fillOpacity="0.55" />
      <circle cx="38.5" cy="7.5" r="1.5" fill="currentColor" fillOpacity="0.7" />
    </svg>
  );
}

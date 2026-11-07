// Decorative artwork. The photos are WebP copies of the images in /mockups, resized for
// how large they are shown (about 94 KB in total instead of about 4 MB of PNGs).
import earthNight from '../assets/earth-night.webp'
import mountains900 from '../assets/mountains-900.webp'
import mountains1800 from '../assets/mountains-1800.webp'

/** Alpenglow mountains for the page header. Fills its (masked) container. */
export function HeroPhoto({ className = '' }: { className?: string }) {
  return (
    <img
      src={mountains1800}
      srcSet={`${mountains900} 900w, ${mountains1800} 1800w`}
      sizes="(min-width: 768px) 75vw, 100vw"
      alt=""
      aria-hidden="true"
      decoding="async"
      fetchPriority="high"
      className={`object-cover object-[55%_35%] ${className}`}
    />
  )
}

/** Earth at night, for the sidebar footer. Fades in from the top so it blends with the panel. */
export function EarthPhoto({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none ${className}`}>
      <img
        src={earthNight}
        alt=""
        decoding="async"
        className="h-full w-full object-cover object-top"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 40%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 40%)',
        }}
      />
      {/* Darken the bottom so the caption stays readable on the city lights. */}
      <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
    </div>
  )
}

/** Soft wave line for the date card. */
export function WaveArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="wave" x1="0" x2="1">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <path d="M0 50 C40 50 60 30 100 34 S160 10 200 4" fill="none" stroke="url(#wave)" strokeWidth="2" />
      <path d="M0 58 C50 56 80 42 120 44 S170 26 200 18" fill="none" stroke="url(#wave)" strokeWidth="1.5" opacity="0.6" />
    </svg>
  )
}

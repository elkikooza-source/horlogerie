import React from 'react';

interface BrandWordmarkProps {
  name?: string;
  size?: 'nav' | 'footer' | 'admin';
  className?: string;
}

/**
 * Miniature haute-horlogerie timepiece replacing the letter "o" in Horlogerie.
 * Drawn as a crisp, scalable SVG with lugs, fluted crown, cardinal batons, and 10:10 hands.
 */
function WatchLetterO({ className = '' }: { className?: string }) {
  return (
    <span
      className={`relative inline-flex items-center justify-center align-baseline mx-[0.02em] translate-y-[0.04em] ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-[0.60em] h-[0.60em] overflow-visible"
      >
        {/* Subtle winding crown at 3 o'clock */}
        <rect
          x="27.2"
          y="14"
          width="2.6"
          height="4"
          rx="0.7"
          fill="#C4A773"
        />

        {/* Circular watch bezel & obsidian dial */}
        <circle
          cx="15.5"
          cy="16"
          r="11.5"
          fill="#0A0A0B"
          stroke="#C4A773"
          strokeWidth="1.75"
        />

        {/* Inner subtle chapter ring */}
        <circle
          cx="15.5"
          cy="16"
          r="9.2"
          stroke="#C4A773"
          strokeOpacity="0.35"
          strokeWidth="0.65"
        />

        {/* Cardinal baton hour indices (12, 3, 6, 9) */}
        <line x1="15.5" y1="6.4" x2="15.5" y2="8.7" stroke="#F5F2EB" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="15.5" y1="23.3" x2="15.5" y2="25.6" stroke="#C4A773" strokeWidth="1.15" strokeLinecap="round" />
        <line x1="5.9" y1="16" x2="8.2" y2="16" stroke="#C4A773" strokeWidth="1.15" strokeLinecap="round" />
        <line x1="22.8" y1="16" x2="25.1" y2="16" stroke="#C4A773" strokeWidth="1.15" strokeLinecap="round" />

        {/* 10:10 Dauphine watch hands (with subtle micro-sweep on hover) */}
        <g className="origin-[15.5px_16px] transition-transform duration-700 ease-out group-hover:rotate-[14deg]">
          <line
            x1="15.5"
            y1="16"
            x2="11.1"
            y2="12.7"
            stroke="#F5F2EB"
            strokeWidth="1.65"
            strokeLinecap="round"
          />
          <line
            x1="15.5"
            y1="16"
            x2="20.7"
            y2="10.9"
            stroke="#C4A773"
            strokeWidth="1.35"
            strokeLinecap="round"
          />
        </g>

        {/* Center gold pinion */}
        <circle cx="15.5" cy="16" r="1.4" fill="#C4A773" />
      </svg>
    </span>
  );
}

export function BrandWordmark({
  name = 'Horlogerie Zeina',
  size = 'nav',
  className = '',
}: BrandWordmarkProps) {
  const cleanName = (name || 'Horlogerie Zeina').trim();
  const oIndex = cleanName.search(/o/i);

  const sizeClasses =
    size === 'footer'
      ? 'text-2xl sm:text-[26px]'
      : size === 'admin'
      ? 'text-3xl'
      : 'text-xl sm:text-[25px]';

  if (oIndex === -1) {
    return (
      <span
        className={`inline-flex items-center gap-2 font-serif font-medium tracking-[0.03em] whitespace-nowrap ${sizeClasses} ${className}`}
      >
        <WatchLetterO />
        <span>{cleanName}</span>
      </span>
    );
  }

  const before = cleanName.slice(0, oIndex);
  const after = cleanName.slice(oIndex + 1);

  return (
    <span
      className={`inline-flex items-baseline font-serif font-medium tracking-[0.03em] whitespace-nowrap ${sizeClasses} ${className}`}
      aria-label={cleanName}
    >
      <span>{before}</span>
      <WatchLetterO />
      <span>{after}</span>
    </span>
  );
}

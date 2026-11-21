import React, { useEffect, useState } from 'react';
import { Watch } from 'lucide-react';

interface ResilientImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackTitle?: string;
  dark?: boolean;
  priority?: boolean;
}

export function ResilientImage({
  src,
  alt,
  className = '',
  fallbackTitle,
  dark = false,
  priority = false,
}: ResilientImageProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-6 text-center ${
          dark
            ? 'bg-gradient-to-br from-[#161619] to-[#0B0B0C] text-[#C5A46D]'
            : 'bg-gradient-to-br from-[#EFECE4] to-[#E5E0D5] text-[#6B665D]'
        } ${className}`}
      >
        <Watch className="w-8 h-8 mb-2 opacity-60 stroke-[1.25]" />
        {fallbackTitle && (
          <span className="text-xs font-medium tracking-wide opacity-75 line-clamp-2 max-w-[180px]">
            {fallbackTitle}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : 'auto'}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
    />
  );
}

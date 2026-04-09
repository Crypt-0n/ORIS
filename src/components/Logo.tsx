import React from 'react';
import logoUrl from '../assets/Logo.png';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

const sizeMap = {
  sm: { container: 'h-7 w-7', text: 'text-base', px: 28 },
  md: { container: 'h-12 w-12', text: 'text-2xl', px: 48 },
  lg: { container: 'h-16 w-16', text: 'text-3xl', px: 64 },
};

export function Logo({ size = 'sm', showText = false }: LogoProps) {
  const { container, text, px } = sizeMap[size];

  return (
    <div className="flex items-center gap-2">
      <div className={`${container} overflow-hidden rounded-lg flex-shrink-0`}>
        <img
          src={logoUrl}
          alt="ORIS"
          width={px}
          height={px}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain"
        />
      </div>
      {showText && (
        <span className={`${text} font-bold text-gray-900 dark:text-white tracking-wide`}>
          ORIS
        </span>
      )}
    </div>
  );
}

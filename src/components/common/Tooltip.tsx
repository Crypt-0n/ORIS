import { ReactNode, useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface TooltipProps {
  content: string;
  children?: ReactNode;
  iconSize?: number;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function Tooltip({ content, children, iconSize = 16, position = 'top', className = '' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  // Position classes
  const posClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-slate-800 dark:border-t-slate-700',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-800 dark:border-b-slate-700',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-slate-800 dark:border-l-slate-700',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-slate-800 dark:border-r-slate-700'
  };

  return (
    <div 
      className={`relative inline-flex items-center justify-center ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children || <HelpCircle size={iconSize} className="text-gray-500 hover:text-purple-500 dark:hover:text-purple-400 transition-colors cursor-help outline-none" tabIndex={0} />}
      
      {isVisible && (
        <div 
          className={`absolute z-50 w-max max-w-xs px-3 py-2 text-xs font-normal text-white bg-slate-800 dark:bg-slate-700 rounded-lg shadow-lg pointer-events-none animate-in fade-in zoom-in-95 duration-200 ${posClasses[position]}`}
          style={{ textShadow: 'none', lineHeight: '1.4' }}
        >
          {content}
          <div className={`absolute border-4 border-transparent ${arrowClasses[position]}`} />
        </div>
      )}
    </div>
  );
}

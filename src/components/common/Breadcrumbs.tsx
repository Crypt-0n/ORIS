import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: any;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  if (!items || items.length === 0) return null;

  return (
    <nav className={`flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm text-gray-500 dark:text-slate-400 overflow-x-auto whitespace-nowrap hide-scrollbar ${className}`}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const Icon = item.icon;
        
        return (
          <div key={index} className="flex items-center">
            {index > 0 ? <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 mx-1 sm:mx-1.5 flex-shrink-0 opacity-50" /> : null}
            
            {Boolean(item.path) && !isLast ? (
              <Link
                to={item.path as string}
                className="flex items-center gap-1 sm:gap-1.5 hover:text-blue-600 dark:hover:text-blue-400 transition"
              >
                {Icon ? <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : null}
                <span className="font-medium truncate max-w-[120px] sm:max-w-[200px]" title={item.label}>{item.label}</span>
              </Link>
            ) : (
              <span className={`flex items-center gap-1 sm:gap-1.5 ${isLast ? 'text-gray-800 dark:text-slate-200 font-semibold' : ''}`}>
                {Icon ? <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : null}
                <span className="truncate max-w-[150px] sm:max-w-[250px]" title={item.label}>{item.label}</span>
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}

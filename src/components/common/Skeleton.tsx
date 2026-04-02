type SkeletonType = 'text' | 'title' | 'avatar' | 'card' | 'table-row';

interface SkeletonProps {
  type?: SkeletonType;
  className?: string;
  count?: number;
}

export function Skeleton({ type = 'text', className = '', count = 1 }: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-gray-200 dark:bg-slate-700/50 rounded';
  
  const getSpecificClasses = () => {
    switch (type) {
      case 'title':
        return 'h-8 w-3/4 mb-4';
      case 'avatar':
        return 'h-10 w-10 min-w-[2.5rem] rounded-full';
      case 'card':
        return 'h-48 w-full rounded-xl';
      case 'table-row':
        return 'h-14 w-full';
      case 'text':
      default:
        return 'h-4 w-full mb-2';
    }
  };

  const elements = Array.from({ length: count }, (_, i) => (
    <div key={i} className={`${baseClasses} ${getSpecificClasses()} ${className}`}></div>
  ));

  return <>{elements}</>;
}

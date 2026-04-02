import { useEffect, useRef, useState, useMemo } from 'react';

export function useInfiniteScroll<T>(items: T[], initialCount = 50, increment = 50) {
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount(initialCount);
  }, [items, initialCount]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && visibleCount < items.length) {
        setVisibleCount((prev) => Math.min(prev + increment, items.length));
      }
    }, { rootMargin: '200px' });

    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [visibleCount, items.length, increment]);

  const visibleItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);
  const hasMore = visibleCount < items.length;

  return { visibleItems, hasMore, loadMoreRef, visibleCount };
}

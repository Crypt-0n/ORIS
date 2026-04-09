import React from 'react';
import { motion, Variants } from 'framer-motion';
import { ReactNode, Suspense } from 'react';
import { useTranslation } from 'react-i18next';

interface AnimatedPageProps {
  children: ReactNode;
  className?: string;
}

const pageVariants: Variants = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, y: -15, transition: { duration: 0.2 } },
};

export const AnimatedPage = ({ children, className }: AnimatedPageProps) => {
  const { t } = useTranslation();
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
      className={className}
    >
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-gray-500 dark:text-slate-400">{t('common.loading')}</div>
        </div>
      }>
        {children}
      </Suspense>
    </motion.div>
  );
};

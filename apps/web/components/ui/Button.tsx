'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost';

const styles: Record<Variant, string> = {
  primary:
    'bg-white text-black hover:bg-white/90 active:scale-[0.97]',
  secondary:
    'bg-surface text-text-primary border border-border-subtle hover:bg-surface-hover active:scale-[0.97]',
  ghost:
    'text-text-secondary hover:text-text-primary hover:bg-white/[0.04]',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5',
        'text-sm font-semibold whitespace-nowrap',
        'transition-all duration-150 ease-snappy',
        'disabled:opacity-40 disabled:pointer-events-none',
        styles[variant],
        className,
      )}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  ),
);

Button.displayName = 'Button';
export { Button };

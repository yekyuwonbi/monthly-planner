import * as React from 'react'

type ButtonVariant = 'default' | 'outline'
type ButtonSize = 'default' | 'icon' | 'sm'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function Button({
  className,
  variant = 'default',
  size = 'default',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cx(
        'inline-flex touch-manipulation transform-gpu items-center justify-center rounded-md border text-sm font-medium transition-[transform,background-color,border-color,box-shadow] duration-150 ease-out hover:scale-[0.985] active:scale-[0.97] md:active:scale-[0.95]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
        'disabled:cursor-not-allowed disabled:opacity-60',
        variant === 'default' && 'border-slate-800 bg-slate-900 px-3 py-2 text-white',
        variant === 'outline' && 'border-slate-300 bg-white px-3 py-2 text-slate-900',
        size === 'icon' && 'h-9 w-9 p-0',
        size === 'sm' && 'h-8 px-2 text-xs',
        className,
      )}
      disabled={disabled}
      {...props}
    />
  )
}

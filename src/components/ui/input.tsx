import * as React from 'react'

type InputProps = React.InputHTMLAttributes<HTMLInputElement>

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type = 'text', ...props }, ref) => {
  return (
    <input
      ref={ref}
      type={type}
      className={cx(
        'h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm text-slate-900',
        'placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
        className,
      )}
      {...props}
    />
  )
})

Input.displayName = 'Input'

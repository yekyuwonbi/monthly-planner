import * as React from 'react'

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

type DivProps = React.HTMLAttributes<HTMLDivElement>
type HeadingProps = React.HTMLAttributes<HTMLHeadingElement>

export function Card({ className, ...props }: DivProps) {
  return <div className={cx('rounded-lg border border-slate-200 bg-white text-slate-900', className)} {...props} />
}

export function CardHeader({ className, ...props }: DivProps) {
  return <div className={cx('flex flex-col space-y-1.5 p-6', className)} {...props} />
}

export function CardTitle({ className, ...props }: HeadingProps) {
  return <h3 className={cx('font-semibold leading-none tracking-tight', className)} {...props} />
}

export function CardContent({ className, ...props }: DivProps) {
  return <div className={cx('p-6 pt-0', className)} {...props} />
}

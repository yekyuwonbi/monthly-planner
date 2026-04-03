import { Button } from "@/components/ui/button"

type SettingsRangeFieldProps = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  hint?: string
  onChange: (value: number) => void
  onButtonPress?: () => void
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function SettingsRangeField({
  label,
  value,
  min,
  max,
  step = 0.02,
  hint,
  onChange,
  onButtonPress,
}: SettingsRangeFieldProps) {
  const percent = Math.round(((value - min) / (max - min)) * 100)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-semibold">{label}</label>
        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
          {Math.round(value * 100)}%
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full"
          onClick={() => {
            onButtonPress?.()
            onChange(clamp(Number((value - step).toFixed(2)), min, max))
          }}
        >
          -
        </Button>

        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="planner-range w-full"
          style={{ ["--range-progress" as string]: `${percent}%` }}
        />

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full"
          onClick={() => {
            onButtonPress?.()
            onChange(clamp(Number((value + step).toFixed(2)), min, max))
          }}
        >
          +
        </Button>
      </div>

      {hint ? <div className="text-xs text-slate-500">{hint}</div> : null}
    </div>
  )
}

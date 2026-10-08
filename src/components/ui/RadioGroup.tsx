'use client'

/**
 * A row of pill-style radio buttons for short fixed option lists. Native
 * radio inputs underneath, so keyboard arrows and form semantics just work.
 */
export default function RadioGroup({
  name, value, onChange, options, disabledValues = [], ariaLabel,
}: {
  name: string
  value: string
  onChange: (value: string) => void
  options: readonly { value: string; label: string; hint?: string }[]
  disabledValues?: string[]
  ariaLabel?: string
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const disabled = disabledValues.includes(o.value)
        const selected = value === o.value
        return (
          <label
            key={o.value}
            title={o.hint}
            className={`flex-1 min-w-[7rem] cursor-pointer rounded-lg border px-3 py-2 text-sm text-center transition-colors
              has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-saffron-500
              ${selected ? 'border-saffron-500 bg-saffron-50 text-saffron-800 font-medium' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'}
              ${disabled ? 'opacity-50 cursor-not-allowed hover:border-gray-300' : ''}`}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
            {o.hint && <span className="block text-[11px] font-normal text-gray-500 mt-0.5">{o.hint}</span>}
          </label>
        )
      })}
    </div>
  )
}

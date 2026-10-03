'use client'
import * as Switch from '@radix-ui/react-switch'
import { useId } from 'react'

/**
 * On/off switch for every yes/no choice in forms. Built on Radix Switch, so
 * it is a real `role="switch"` with keyboard (Space/Enter) and screen-reader
 * support. The whole row is clickable, which keeps it easy to hit on mobile.
 */
export default function ToggleSwitch({
  checked, onCheckedChange, label, description, disabled,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <label htmlFor={id} className="flex-1 cursor-pointer select-none">
        <span className="block text-sm font-medium text-gray-800">{label}</span>
        {description && <span className="block text-xs text-gray-500 mt-0.5">{description}</span>}
      </label>
      <Switch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full bg-gray-200 transition-colors
                   data-[state=checked]:bg-saffron-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron-500
                   focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Switch.Thumb
          className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform
                     data-[state=checked]:translate-x-[22px] motion-reduce:transition-none"
        />
      </Switch.Root>
    </div>
  )
}

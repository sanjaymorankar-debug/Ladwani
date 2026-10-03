'use client'
import type { ReactNode } from 'react'

/**
 * Smoothly expands/collapses a conditional section (height + fade). Hidden
 * content is `invisible`, so it drops out of the tab order and the
 * accessibility tree once collapsed. Honours reduced-motion preferences.
 */
export default function Reveal({ open, children, className = '' }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <div
      aria-hidden={!open}
      className={`grid transition-all duration-300 ease-in-out motion-reduce:transition-none
        ${open ? 'grid-rows-[1fr] opacity-100 visible' : 'grid-rows-[0fr] opacity-0 invisible'} ${className}`}
    >
      {/* -mx-1/px-1: room for focus rings, which overflow-hidden would clip. */}
      <div className="overflow-hidden min-h-0 -mx-1 px-1">{children}</div>
    </div>
  )
}

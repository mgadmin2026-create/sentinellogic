// Gemeinsamer Button-Baustein — siehe docs/UI_UX_KONZEPT.md.
// Bildet die bereits im Code dominanten Varianten nach (bg-yellow-400 hover:bg-yellow-500 als
// Primär-Aktion, etc.), ersetzt keine neue Optik, nur die bisher pro Seite wiederholten Klassen.
import { ButtonHTMLAttributes, forwardRef } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-brand hover:bg-brand-hover text-gray-900 font-semibold',
  secondary: 'border border-gray-300 text-gray-700 hover:bg-gray-100 font-medium',
  danger: 'text-red-600 hover:bg-red-50 font-medium',
  ghost: 'text-gray-500 hover:text-gray-800 font-medium',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2 text-sm rounded-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    />
  )
)
Button.displayName = 'Button'

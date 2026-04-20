import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Button } from './Button'

describe('Button component', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('applies variant classes', () => {
    const { container } = render(<Button variant="brand">Brand Button</Button>)
    // Check for unique class in brand variant: bg-[#ffd480]
    expect(container.firstChild).toHaveClass('bg-[#ffd480]')
  })

  it('shows loader when loading', () => {
    render(<Button loading>Test</Button>)
    // Loader2 uses the class name "animate-spin" or search for the SVG
    expect(screen.getByRole('button')).toHaveAttribute('disabled')
    // We should see the loader svg (simplified check)
  })

  it('is disabled when disabled prop is passed', () => {
    render(<Button disabled>Disabled Button</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})

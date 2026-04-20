import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn utility', () => {
  it('merges tailwind classes correctly', () => {
    expect(cn('px-2 py-2', 'px-4')).toBe('py-2 px-4')
  })

  it('handles conditional classes', () => {
    expect(cn('px-2', true && 'py-2', false && 'bg-red-500')).toBe('px-2 py-2')
  })

  it('handles arrays and objects', () => {
     expect(cn(['px-2', 'py-2'], { 'bg-red-500': true, 'text-white': false })).toBe('px-2 py-2 bg-red-500')
  })
})

import { describe, expect, it } from 'vitest'
import { timeAgo } from './date'
import { parseSection } from './section'

const now = new Date('2026-11-07T12:00:00Z')

describe('timeAgo', () => {
  it('formats recent times', () => {
    expect(timeAgo('2026-11-07T11:59:30Z', now)).toBe('just now')
    expect(timeAgo('2026-11-07T11:55:00Z', now)).toBe('5 minutes ago')
    expect(timeAgo('2026-11-07T09:00:00Z', now)).toBe('3 hours ago')
    expect(timeAgo('2026-11-06T10:00:00Z', now)).toBe('yesterday')
  })

  it('returns empty for invalid input', () => {
    expect(timeAgo('nope', now)).toBe('')
  })
})

describe('parseSection', () => {
  it('accepts known sections and falls back to technology', () => {
    expect(parseSection('nature')).toBe('nature')
    expect(parseSection('sports')).toBe('technology')
    expect(parseSection(null)).toBe('technology')
  })
})

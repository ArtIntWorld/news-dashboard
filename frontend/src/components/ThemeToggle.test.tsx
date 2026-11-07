import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import ThemeToggle from './ThemeToggle'

afterEach(() => document.documentElement.classList.remove('dark'))

describe('ThemeToggle', () => {
  it('switches between light and dark and remembers the choice', async () => {
    render(<ThemeToggle />)
    expect(document.documentElement).not.toHaveClass('dark')
    await userEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }))
    expect(document.documentElement).toHaveClass('dark')
    expect(window.localStorage.getItem('news.theme')).toBe('dark')
    await userEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))
    expect(document.documentElement).not.toHaveClass('dark')
    expect(window.localStorage.getItem('news.theme')).toBe('light')
  })
})

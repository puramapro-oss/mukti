import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import ExorcismeCompletion from '../../src/components/exorcisme/ExorcismeCompletion'

it('focuses the completion heading and always keeps an explicit exit available', () => {
  const leave = vi.fn(), retry = vi.fn()
  render(<ExorcismeCompletion saving error={null} onLeave={leave} onRetry={retry} />)
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Séance arrêtée' }))
  expect(screen.getByRole('status').textContent).toContain('en cours')
  expect(screen.queryByRole('button', { name: 'Réessayer l’enregistrement' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Quitter sans confirmation' }))
  expect(leave).toHaveBeenCalledOnce()
})

it('exposes an unconfirmed save and lets the person retry the existing payload', () => {
  const leave = vi.fn(), retry = vi.fn()
  render(<ExorcismeCompletion saving={false} error="Enregistrement non confirmé." onLeave={leave} onRetry={retry} />)
  expect(screen.getByRole('alert').textContent).toBe('Enregistrement non confirmé.')
  fireEvent.click(screen.getByRole('button', { name: 'Réessayer l’enregistrement' }))
  expect(retry).toHaveBeenCalledOnce()
  expect(leave).not.toHaveBeenCalled()
})

it('offers an exit but no impossible retry for an invalid elapsed measurement', () => {
  const leave = vi.fn()
  render(<ExorcismeCompletion saving={false} canRetry={false} error="Durée invalide." onLeave={leave} onRetry={vi.fn()} />)
  expect(screen.queryByRole('button', { name: 'Réessayer l’enregistrement' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Quitter sans confirmation' }))
  expect(leave).toHaveBeenCalledOnce()
})

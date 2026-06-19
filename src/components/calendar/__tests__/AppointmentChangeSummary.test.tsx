/**
 * @jest-environment jsdom
 */

import { describe, expect, it } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { AppointmentChangeSummary } from '../AppointmentChangeSummary'

describe('AppointmentChangeSummary', () => {
  it('renders nothing when summary is absent', () => {
    const { container } = render(<AppointmentChangeSummary />)
    expect(container.firstChild).toBeNull()
  })

  it('renders change text when provided', () => {
    render(<AppointmentChangeSummary summary="Remarcado pela IA há 12 min" />)
    expect(screen.getByText(/Remarcado pela IA/)).toBeInTheDocument()
  })

  it('renders summary as text element with truncation', () => {
    const longSummary = 'Remarcado de quarta 14:00 para quinta 09:30 devido a conflito de agenda'
    render(<AppointmentChangeSummary summary={longSummary} />)
    expect(screen.getByText(/Remarcado/)).toBeInTheDocument()
  })
})

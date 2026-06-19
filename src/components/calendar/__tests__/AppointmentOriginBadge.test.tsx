/**
 * @jest-environment jsdom
 */

import { describe, expect, it } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { AppointmentOriginBadge } from '../AppointmentOriginBadge'

describe('AppointmentOriginBadge', () => {
  it('renders IA label for ai origin', () => {
    render(<AppointmentOriginBadge origin="ai" />)
    expect(screen.getByText('IA')).toBeInTheDocument()
  })

  it('renders Manual label for manual origin', () => {
    render(<AppointmentOriginBadge origin="manual" />)
    expect(screen.getByText('Manual')).toBeInTheDocument()
  })

  it('renders nothing when origin is undefined', () => {
    const { container } = render(<AppointmentOriginBadge />)
    expect(container.firstChild).toBeNull()
  })
})

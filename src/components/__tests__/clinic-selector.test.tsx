/**
 * @jest-environment jsdom
 */

import React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ClinicSelector, type ClinicOption } from '../clinic-selector'
import { useAuth } from '@/lib/auth/context'

jest.mock('@/lib/auth/context', () => ({
  useAuth: jest.fn(),
}))

const mockUseAuth = useAuth as jest.Mock

function wrapWithQueryClient(ui: React.ReactElement) {
  const qc = new QueryClient()
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
}

describe('ClinicSelector (F4.09 & F4.10)', () => {
  const mockSwitchClinic = jest.fn().mockResolvedValue({})

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders null / hidden for single-clinic user (F4.09)', () => {
    mockUseAuth.mockReturnValue({
      profile: {
        clinic_id: 'c1',
        role: 'owner',
        clinics: { id: 'c1', name: 'Clinica Centro' },
      },
      switchClinic: mockSwitchClinic,
    })

    const { container } = render(wrapWithQueryClient(<ClinicSelector />))
    expect(container.firstChild).toBeNull()
  })

  it('renders null when propClinics has only 1 clinic', () => {
    mockUseAuth.mockReturnValue({
      profile: { clinic_id: 'c1' },
      switchClinic: mockSwitchClinic,
    })

    const singleClinic: ClinicOption[] = [{ id: 'c1', name: 'Clinica A' }]
    const { container } = render(wrapWithQueryClient(<ClinicSelector clinics={singleClinic} />))
    expect(container.firstChild).toBeNull()
  })

  it('renders selector when multiple clinics are available (F4.09)', () => {
    mockUseAuth.mockReturnValue({
      profile: { clinic_id: 'c1' },
      switchClinic: mockSwitchClinic,
    })

    const multiClinics: ClinicOption[] = [
      { id: 'c1', name: 'Clinica Centro', role: 'owner' },
      { id: 'c2', name: 'Clinica Sul', role: 'dentist' },
    ]

    render(wrapWithQueryClient(<ClinicSelector clinics={multiClinics} />))
    expect(screen.getByTestId('clinic-selector')).toBeInTheDocument()
    expect(screen.getByTestId('clinic-selector-trigger')).toBeInTheDocument()
  })
})

import {
  contactsDomainBoundary,
  getContactOwnershipCopy,
  patientDomainBoundary,
  relationshipDomainBoundary,
} from '@/lib/domain-boundaries'

describe('domain boundaries copy', () => {
  test('defines patients as clinical domain', () => {
    expect(patientDomainBoundary.title).toBe('Pacientes')
    expect(patientDomainBoundary.description).toContain('clínico')
    expect(patientDomainBoundary.description).toContain('histórico')
  })

  test('defines contacts as crm domain', () => {
    expect(contactsDomainBoundary.title).toBe('Contatos')
    expect(contactsDomainBoundary.description).toContain('CRM')
    expect(contactsDomainBoundary.description).toContain('pacientes e leads')
  })

  test('defines relationship area as crm-owned', () => {
    expect(relationshipDomainBoundary.title).toContain('CRM')
    expect(relationshipDomainBoundary.description).toContain('timeline')
    expect(relationshipDomainBoundary.description).toContain('Contatos')
  })

  test('describes patient contacts as crm mirror, not clinical source', () => {
    const copy = getContactOwnershipCopy('patient')

    expect(copy.title).toContain('CRM')
    expect(copy.description).toContain('Pacientes')
    expect(copy.description).toContain('cadastro clínico')
  })

  test('describes lead contacts as crm-owned', () => {
    const copy = getContactOwnershipCopy('lead')

    expect(copy.title).toContain('CRM')
    expect(copy.description).toContain('lead')
  })
})

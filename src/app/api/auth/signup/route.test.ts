import { NextRequest } from 'next/server'
import { POST } from './route'
import { createUserWithClinic, findUserByEmail } from '@/repositories/auth'

jest.mock('@/repositories/auth', () => ({
  createUserWithClinic: jest.fn(),
  findUserByEmail: jest.fn(),
}))

const mockFindUserByEmail = findUserByEmail as jest.MockedFunction<typeof findUserByEmail>
const originalNodeEnv = process.env.NODE_ENV

function request() {
  return new NextRequest('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'new@example.com',
      password: 'password123',
      name: 'New User',
      clinicName: 'New Clinic',
    }),
  })
}

describe('POST /api/auth/signup', () => {
  afterEach(() => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv
    jest.clearAllMocks()
  })

  it('returns not found and does not touch persistence in production', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'

    const response = await POST(request())

    expect(response.status).toBe(404)
    expect(mockFindUserByEmail).not.toHaveBeenCalled()
  })

  it('keeps the duplicate-account response outside production', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'test'
    mockFindUserByEmail.mockResolvedValue({ id: 'existing-user' })

    const response = await POST(request())

    expect(response.status).toBe(409)
    expect(mockFindUserByEmail).toHaveBeenCalledWith('new@example.com')
  })
})

/**
 * Shared Drizzle mock for tests
 * Import this in test files to configure the mock chain
 */

type MockFn = ReturnType<typeof jest.fn>

function createDrizzleMock() {
  const selectChain: MockFn = jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn(() => Promise.resolve([])),
      orderBy: jest.fn(() => ({
        where: jest.fn(() => Promise.resolve([])),
      })),
      limit: jest.fn(() => Promise.resolve([])),
      returning: jest.fn(() => Promise.resolve([])),
      leftJoin: jest.fn().mockReturnValue({
        where: jest.fn(() => Promise.resolve([])),
      }),
    })),
    leftJoin: jest.fn().mockReturnValue({
      where: jest.fn(() => Promise.resolve([])),
    }),
  }))

  const insertChain: MockFn = jest.fn(() => ({
    values: jest.fn(() => ({
      returning: jest.fn(() => Promise.resolve([{ id: 'test-id' }])),
    })),
  }))

  const updateChain: MockFn = jest.fn(() => ({
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn(() => Promise.resolve([{ id: 'test-id' }])),
      }),
      returning: jest.fn(() => Promise.resolve([{ id: 'test-id' }])),
    }),
    where: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn(() => Promise.resolve([])),
        returning: jest.fn(() => Promise.resolve([{ id: 'test-id' }])),
      }),
    }),
  }))

  const deleteChain: MockFn = jest.fn(() => ({
    where: jest.fn(() => Promise.resolve([])),
  }))

  return {
    select: selectChain,
    insert: insertChain,
    update: updateChain,
    delete: deleteChain,
  }
}

export const mockDb = createDrizzleMock()

export function resetMockDb() {
  ;(mockDb.select as MockFn).mockClear()
  ;(mockDb.insert as MockFn).mockClear()
  ;(mockDb.update as MockFn).mockClear()
  ;(mockDb.delete as MockFn).mockClear()
}
import { createGoal, updateGoal } from '../goal-service';

jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(() => ({
    insert: jest.fn(() => ({ values: jest.fn(() => ({ returning: jest.fn() })) })),
    update: jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn(() => ({ returning: jest.fn() })) })) })),
  })),
}));

describe('goal status and title validation', () => {
  it('rejects an invalid status when creating a goal', async () => {
    await expect(createGoal({
      clinicId: 'clinic',
      title: 'Quarterly goal',
      status: 'invalid' as never,
    })).rejects.toThrow('Invalid goal status: invalid');
  });

  it('rejects an invalid status when updating a goal', async () => {
    await expect(updateGoal('goal', 'clinic', {
      status: 'invalid' as never,
    })).rejects.toThrow('Invalid goal status: invalid');
  });

  it.each(['', '   '])('rejects an empty title on create (%j)', async (title) => {
    await expect(createGoal({ clinicId: 'clinic', title }))
      .rejects.toThrow('Goal title must not be empty');
  });

  it('rejects an empty title when updating', async () => {
    await expect(updateGoal('goal', 'clinic', { title: '  ' }))
      .rejects.toThrow('Goal title must not be empty');
  });
});

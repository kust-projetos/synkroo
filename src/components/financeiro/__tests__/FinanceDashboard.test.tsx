/**
 * Tests: Financeiro dashboard components.
 *
 * Covers:
 * - Null ratios render as dash
 * - Cancel charge button visible for open charge + permission
 * 
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { FinanceDashboard } from '../FinanceDashboard';

describe('FinanceDashboard', () => {
  test('renders null ratios as dash', () => {
    render(
      <FinanceDashboard
        metrics={{ budgetConversion: null, collectionRecovery: null }}
        charges={[]}
      />,
    );
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  function renderWithTab(tabName: string, props: Partial<Parameters<typeof FinanceDashboard>[0]> = {}) {
    const result = render(
      <FinanceDashboard
        metrics={{ budgetConversion: null, collectionRecovery: null }}
        charges={[]}
        {...props}
      />,
    );
    // Navigate to the specified tab via fireEvent
    const tabButton = screen.getByRole('button', { name: tabName });
    fireEvent.click(tabButton);
    return result;
  }

  test('shows cancel charge only for open charge with permission', () => {
    renderWithTab('Cobranças', {
      metrics: { budgetConversion: 0.75, collectionRecovery: 0.5 },
      charges: [{ id: 'ch1', status: 'pending' }],
      canManageBudget: true,
    });
    expect(screen.getByRole('button', { name: /cancelar cobrança/i })).toBeInTheDocument();
  });

  test('hides cancel charge when user lacks permission', () => {
    renderWithTab('Cobranças', {
      metrics: { budgetConversion: 0.75, collectionRecovery: 0.5 },
      charges: [{ id: 'ch1', status: 'pending' }],
      canManageBudget: false,
    });
    expect(screen.queryByRole('button', { name: /cancelar cobrança/i })).not.toBeInTheDocument();
  });

  test('hides cancel charge when charge is already settled', () => {
    renderWithTab('Cobranças', {
      metrics: { budgetConversion: 0.75, collectionRecovery: 0.5 },
      charges: [{ id: 'ch2', status: 'paid' }],
      canManageBudget: true,
    });
    expect(screen.queryByRole('button', { name: /cancelar cobrança/i })).not.toBeInTheDocument();
  });
});

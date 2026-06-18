/** @jest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react';
import { PermissionMatrix } from '../PermissionMatrix';

const groups = [{
  module: 'operacional', moduleLabel: 'Atendimento e agenda',
  permissions: [
    { key: 'operacional:create', module: 'operacional', label: 'Criar agendamento' },
    { key: 'operacional:cancel', module: 'operacional', label: 'Cancelar agendamento' },
  ],
}];

it('toggles a single function and reflects selection', () => {
  const onChange = jest.fn();
  render(<PermissionMatrix groups={groups} selected={new Set()} onChange={onChange} />);
  fireEvent.click(screen.getByLabelText('Criar agendamento'));
  expect(onChange).toHaveBeenCalledWith(expect.any(Set));
  const arg = onChange.mock.calls[0][0] as Set<string>;
  expect(arg.has('operacional:create')).toBe(true);
});

it('module toggle selects all functions of the module', () => {
  const onChange = jest.fn();
  render(<PermissionMatrix groups={groups} selected={new Set()} onChange={onChange} />);
  fireEvent.click(screen.getByLabelText('Atendimento e agenda'));   // toggle do módulo
  const arg = onChange.mock.calls[0][0] as Set<string>;
  expect(arg.has('operacional:create')).toBe(true);
  expect(arg.has('operacional:cancel')).toBe(true);
});

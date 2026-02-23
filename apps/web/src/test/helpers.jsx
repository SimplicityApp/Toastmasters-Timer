import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../context/ToastContext';
import { TimerProvider } from '../context/TimerContext';

export function renderWithProviders(ui, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>
        <TimerProvider>
          {ui}
        </TimerProvider>
      </ToastProvider>
    </MemoryRouter>
  );
}

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { TimerProvider, useTimer } from '../context/TimerContext';
import { ToastProvider } from '../context/ToastContext';
import ReportTab from './ReportTab';
import { renderWithProviders } from '../test/helpers';

// Wrapper that pre-populates reports before rendering ReportTab
function ReportTabWithData() {
  const { addReport } = useTimer();
  useEffect(() => {
    addReport({
      name: 'Alice',
      role: 'Standard Speech',
      duration: 350,
      color: 'green',
      comments: '',
      disqualified: false,
    });
    addReport({
      name: 'Bob',
      role: 'Ice Breaker',
      duration: 400,
      color: 'red',
      comments: 'Passed red by 40 seconds',
      disqualified: false,
    });
  }, []);
  return <ReportTab />;
}

function renderWithData() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <TimerProvider>
          <ReportTabWithData />
        </TimerProvider>
      </ToastProvider>
    </MemoryRouter>
  );
}

describe('ReportTab', () => {
  describe('empty state', () => {
    it('renders "No reports yet" message when there are no reports', () => {
      renderWithProviders(<ReportTab />);
      expect(
        screen.getByText(/no reports yet/i)
      ).toBeInTheDocument();
    });

    it('does not render the table when there are no reports', () => {
      renderWithProviders(<ReportTab />);
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('does not render Copy or Clear buttons when there are no reports', () => {
      renderWithProviders(<ReportTab />);
      expect(screen.queryByRole('button', { name: /copy/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
    });
  });

  describe('with reports', () => {
    it('renders the report table with Alice and Bob visible', async () => {
      renderWithData();
      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();
      });
    });

    it('renders all expected table headers', async () => {
      renderWithData();
      await waitFor(() => {
        expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'Role' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'Time' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'Over time' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'Comments' })).toBeInTheDocument();
      });
    });

    it('renders report data for Alice with correct role and color', async () => {
      renderWithData();
      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Standard Speech')).toBeInTheDocument();
        expect(screen.getByText('green')).toBeInTheDocument();
      });
    });

    it('renders report data for Bob with comments', async () => {
      renderWithData();
      await waitFor(() => {
        expect(screen.getByText('Bob')).toBeInTheDocument();
        expect(screen.getByText('Ice Breaker')).toBeInTheDocument();
        expect(screen.getByText('Passed red by 40 seconds')).toBeInTheDocument();
      });
    });

    it('renders Copy Report button', async () => {
      renderWithData();
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /copy report to clipboard/i })
        ).toBeInTheDocument();
      });
    });

    it('renders Clear button', async () => {
      renderWithData();
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /clear/i })
        ).toBeInTheDocument();
      });
    });
  });

  describe('clear reports flow', () => {
    it('shows ConfirmModal when Clear is clicked', async () => {
      const user = userEvent.setup();
      renderWithData();

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });

      const clearButton = screen.getByRole('button', { name: /clear/i });
      await user.click(clearButton);

      expect(screen.getByText('Clear All Reports')).toBeInTheDocument();
      expect(
        screen.getByText(/are you sure you want to clear all reports/i)
      ).toBeInTheDocument();
    });

    it('dismisses ConfirmModal without clearing when Cancel is clicked', async () => {
      const user = userEvent.setup();
      renderWithData();

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /clear/i }));
      expect(screen.getByText('Clear All Reports')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(screen.queryByText('Clear All Reports')).not.toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    it('clears all reports when Clear All is confirmed', async () => {
      const user = userEvent.setup();
      renderWithData();

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /clear/i }));
      expect(screen.getByText('Clear All Reports')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /clear all/i }));

      await waitFor(() => {
        expect(screen.getByText(/no reports yet/i)).toBeInTheDocument();
      });

      expect(screen.queryByText('Alice')).not.toBeInTheDocument();
      expect(screen.queryByText('Bob')).not.toBeInTheDocument();
    });
  });
});

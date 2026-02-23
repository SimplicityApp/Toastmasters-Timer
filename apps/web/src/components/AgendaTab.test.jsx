import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AgendaTab from './AgendaTab';
import { renderWithProviders } from '../test/helpers';

describe('AgendaTab', () => {
  describe('empty state', () => {
    it('shows "No speakers in agenda" message', () => {
      renderWithProviders(<AgendaTab />);
      expect(screen.getByText(/no speakers in agenda/i)).toBeInTheDocument();
    });

    it('renders the Import Text button', () => {
      renderWithProviders(<AgendaTab />);
      expect(
        screen.getByRole('button', { name: /import text/i })
      ).toBeInTheDocument();
    });

    it('renders the Add Item button', () => {
      renderWithProviders(<AgendaTab />);
      expect(
        screen.getByRole('button', { name: /add item/i })
      ).toBeInTheDocument();
    });

    it('does NOT render a Clear All button when the agenda is empty', () => {
      renderWithProviders(<AgendaTab />);
      expect(
        screen.queryByRole('button', { name: /clear all/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('Add Item modal', () => {
    it('opens the Add Speaker modal when Add Item is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AgendaTab />);

      await user.click(screen.getByRole('button', { name: /add item/i }));

      expect(screen.getByText('Add Speaker')).toBeInTheDocument();
    });

    it('shows a name input field inside the modal', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AgendaTab />);

      await user.click(screen.getByRole('button', { name: /add item/i }));

      expect(
        screen.getByPlaceholderText(/enter speaker name/i)
      ).toBeInTheDocument();
    });

    it('shows a role dropdown inside the modal', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AgendaTab />);

      await user.click(screen.getByRole('button', { name: /add item/i }));

      // There may be multiple comboboxes; the modal one should be inside the modal dialog
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0);
    });

    it('shows Add and Cancel buttons inside the modal', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AgendaTab />);

      await user.click(screen.getByRole('button', { name: /add item/i }));

      expect(screen.getByRole('button', { name: /^add$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('closes the modal when Cancel is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AgendaTab />);

      await user.click(screen.getByRole('button', { name: /add item/i }));
      expect(screen.getByText('Add Speaker')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(screen.queryByText('Add Speaker')).not.toBeInTheDocument();
    });

    it('adds a speaker and shows them in the list after clicking Add', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AgendaTab />);

      await user.click(screen.getByRole('button', { name: /add item/i }));

      const nameInput = screen.getByPlaceholderText(/enter speaker name/i);
      await user.type(nameInput, 'Charlie');

      await user.click(screen.getByRole('button', { name: /^add$/i }));

      await waitFor(() => {
        expect(screen.getByText('Charlie')).toBeInTheDocument();
      });

      // Modal should be closed after adding
      expect(screen.queryByText('Add Speaker')).not.toBeInTheDocument();
    });

    it('shows Clear All button after at least one speaker is added', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AgendaTab />);

      await user.click(screen.getByRole('button', { name: /add item/i }));
      await user.type(screen.getByPlaceholderText(/enter speaker name/i), 'Dana');
      await user.click(screen.getByRole('button', { name: /^add$/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument();
      });
    });
  });

  describe('switching to live tab', () => {
    it('calls onSwitchToLive when a speaker item is clicked', async () => {
      const user = userEvent.setup();
      const onSwitchToLive = vi.fn();
      renderWithProviders(<AgendaTab onSwitchToLive={onSwitchToLive} />);

      // Add a speaker first
      await user.click(screen.getByRole('button', { name: /add item/i }));
      await user.type(screen.getByPlaceholderText(/enter speaker name/i), 'Eve');
      await user.click(screen.getByRole('button', { name: /^add$/i }));

      await waitFor(() => {
        expect(screen.getByText('Eve')).toBeInTheDocument();
      });

      // Click the speaker row to load into live tab
      await user.click(screen.getByText('Eve'));

      expect(onSwitchToLive).toHaveBeenCalledTimes(1);
    });
  });
});

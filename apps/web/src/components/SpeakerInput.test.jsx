import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SpeakerInput from './SpeakerInput';

const defaultProps = {
  value: '',
  onChange: vi.fn(),
  onRoleChange: vi.fn(),
  selectedRole: 'Standard Speech',
  roleOptions: ['Standard Speech', 'Ice Breaker', 'Short Roles'],
  onEditRules: vi.fn(),
  agendaItems: [
    { id: '1', name: 'Alice', role: 'Standard Speech', completed: false },
    { id: '2', name: 'Bob', role: 'Ice Breaker', completed: false },
    { id: '3', name: 'Carol', role: 'Short Roles', completed: true },
  ],
  onSelectSuggestion: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SpeakerInput', () => {
  describe('rendering', () => {
    it('renders the speaker name input and role selector', () => {
      render(<SpeakerInput {...defaultProps} />);

      expect(screen.getByPlaceholderText('Type speaker name...')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('shows all role options in the role selector', () => {
      render(<SpeakerInput {...defaultProps} />);

      expect(screen.getByRole('option', { name: 'Standard Speech' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Ice Breaker' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Short Roles' })).toBeInTheDocument();
    });
  });

  describe('suggestions dropdown', () => {
    it('shows only uncompleted agenda items when the input is focused', async () => {
      const user = userEvent.setup();
      render(<SpeakerInput {...defaultProps} />);

      await user.click(screen.getByPlaceholderText('Type speaker name...'));

      // Alice and Bob are uncompleted; Carol is completed and should be hidden
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.queryByText('Carol')).not.toBeInTheDocument();
    });

    it('filters suggestions when the user types, calling onChange on each keystroke', async () => {
      const user = userEvent.setup();
      render(<SpeakerInput {...defaultProps} value="" />);

      const input = screen.getByPlaceholderText('Type speaker name...');
      await user.click(input);
      await user.type(input, 'Ali');

      // The component is controlled: each keystroke fires onChange.
      // With 3 characters typed, onChange should have been called 3 times.
      expect(defaultProps.onChange).toHaveBeenCalledTimes(3);
    });

    it('filters suggestions based on the current value prop', async () => {
      const user = userEvent.setup();
      // Render with value='Ali' — only Alice should appear in suggestions
      render(<SpeakerInput {...defaultProps} value="Ali" />);

      // Focus the input to show suggestions
      await user.click(screen.getByPlaceholderText('Type speaker name...'));

      // Alice matches 'Ali'; Bob does not
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.queryByText('Bob')).not.toBeInTheDocument();
    });

    it('closes suggestions on Escape key', async () => {
      const user = userEvent.setup();
      render(<SpeakerInput {...defaultProps} />);

      const input = screen.getByPlaceholderText('Type speaker name...');
      await user.click(input);

      // Suggestions should be visible now
      expect(screen.getByText('Alice')).toBeInTheDocument();

      await user.keyboard('{Escape}');

      // After Escape the dropdown should be gone
      expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    });

    it('highlights first suggestion on ArrowDown and selects it on Enter', async () => {
      const user = userEvent.setup();
      render(<SpeakerInput {...defaultProps} />);

      const input = screen.getByPlaceholderText('Type speaker name...');
      await user.click(input);

      // Press ArrowDown to highlight the first item (Alice)
      await user.keyboard('{ArrowDown}');

      const firstSuggestion = screen.getByText('Alice').closest('li');
      expect(firstSuggestion).toHaveClass('bg-blue-50');

      // Press Enter to select
      await user.keyboard('{Enter}');

      expect(defaultProps.onSelectSuggestion).toHaveBeenCalledTimes(1);
      expect(defaultProps.onSelectSuggestion).toHaveBeenCalledWith(
        expect.objectContaining({ id: '1', name: 'Alice' })
      );
    });

    it('calls onSelectSuggestion when a suggestion is clicked', async () => {
      const user = userEvent.setup();
      render(<SpeakerInput {...defaultProps} />);

      await user.click(screen.getByPlaceholderText('Type speaker name...'));
      await user.click(screen.getByText('Bob').closest('li'));

      expect(defaultProps.onSelectSuggestion).toHaveBeenCalledTimes(1);
      expect(defaultProps.onSelectSuggestion).toHaveBeenCalledWith(
        expect.objectContaining({ id: '2', name: 'Bob' })
      );
    });
  });

  describe('edit timing rules link', () => {
    it('calls onEditRules when the "Edit timing rules" link is clicked', async () => {
      const user = userEvent.setup();
      render(<SpeakerInput {...defaultProps} />);

      await user.click(screen.getByText('Edit timing rules'));

      expect(defaultProps.onEditRules).toHaveBeenCalledTimes(1);
    });
  });
});

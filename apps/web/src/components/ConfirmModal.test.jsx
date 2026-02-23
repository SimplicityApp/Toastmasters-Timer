import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmModal from './ConfirmModal';

describe('ConfirmModal', () => {
  const baseProps = {
    isOpen: true,
    title: 'Delete item',
    message: 'Are you sure you want to delete this item?',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <ConfirmModal {...baseProps} isOpen={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the title and message when isOpen is true', () => {
    render(<ConfirmModal {...baseProps} />);

    expect(screen.getByText('Delete item')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete this item?')).toBeInTheDocument();
  });

  it('defaults confirm button text to "Confirm" and cancel button text to "Cancel"', () => {
    render(<ConfirmModal {...baseProps} />);

    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('uses custom confirmText and cancelText when provided', () => {
    render(
      <ConfirmModal
        {...baseProps}
        confirmText="Yes, delete"
        cancelText="Go back"
      />
    );

    expect(screen.getByRole('button', { name: 'Yes, delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go back' })).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', async () => {
    const user = userEvent.setup();
    render(<ConfirmModal {...baseProps} />);

    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
    expect(baseProps.onCancel).not.toHaveBeenCalled();
  });

  it('calls onCancel when the cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<ConfirmModal {...baseProps} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
    expect(baseProps.onConfirm).not.toHaveBeenCalled();
  });

  it('calls onCancel when the X (close) button is clicked', async () => {
    const user = userEvent.setup();
    render(<ConfirmModal {...baseProps} />);

    // The X button has aria-label from the lucide X icon; query by its
    // position as the close button in the modal header.
    const buttons = screen.getAllByRole('button');
    // The close button is the one that is not "Confirm" or "Cancel"
    const closeButton = buttons.find(
      (btn) => btn.textContent !== 'Confirm' && btn.textContent !== 'Cancel'
    );
    expect(closeButton).toBeDefined();

    await user.click(closeButton);

    expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
    expect(baseProps.onConfirm).not.toHaveBeenCalled();
  });
});

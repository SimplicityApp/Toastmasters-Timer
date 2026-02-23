import { render, screen } from '@testing-library/react';
import TimerDisplay from './TimerDisplay';

describe('TimerDisplay', () => {
  describe('time formatting', () => {
    it('renders "00:00" when elapsedTime is 0', () => {
      render(<TimerDisplay elapsedTime={0} status="blue" />);
      expect(screen.getByText('00:00')).toBeInTheDocument();
    });

    it('renders "02:05" when elapsedTime is 125 seconds', () => {
      render(<TimerDisplay elapsedTime={125} status="blue" />);
      expect(screen.getByText('02:05')).toBeInTheDocument();
    });
  });

  describe('background color classes', () => {
    it('applies bg-blue-500 class when status is "blue"', () => {
      const { container } = render(<TimerDisplay elapsedTime={0} status="blue" />);
      expect(container.firstChild).toHaveClass('bg-blue-500');
    });

    it('applies bg-green-500 class when status is "green"', () => {
      const { container } = render(<TimerDisplay elapsedTime={35} status="green" />);
      expect(container.firstChild).toHaveClass('bg-green-500');
    });

    it('applies bg-yellow-500 class when status is "yellow"', () => {
      const { container } = render(<TimerDisplay elapsedTime={50} status="yellow" />);
      expect(container.firstChild).toHaveClass('bg-yellow-500');
    });

    it('applies bg-red-500 class when status is "red"', () => {
      const { container } = render(<TimerDisplay elapsedTime={65} status="red" />);
      expect(container.firstChild).toHaveClass('bg-red-500');
    });
  });

  describe('phase text', () => {
    const rules = { green: 30, yellow: 45, red: 60 };

    it('shows "Blue phase" text when rules are provided and status is blue', () => {
      render(<TimerDisplay elapsedTime={0} status="blue" rules={rules} />);
      expect(screen.getByText(/Blue phase/)).toBeInTheDocument();
    });

    it('shows "Green phase" text when status is green', () => {
      render(<TimerDisplay elapsedTime={35} status="green" rules={rules} />);
      expect(screen.getByText(/Green phase/)).toBeInTheDocument();
    });

    it('shows "Yellow phase" text when status is yellow', () => {
      render(<TimerDisplay elapsedTime={50} status="yellow" rules={rules} />);
      expect(screen.getByText(/Yellow phase/)).toBeInTheDocument();
    });

    it('shows "Red phase" text when status is red', () => {
      render(<TimerDisplay elapsedTime={65} status="red" rules={rules} />);
      expect(screen.getByText(/Red phase/)).toBeInTheDocument();
    });

    it('does NOT show phase text when rules are not provided', () => {
      render(<TimerDisplay elapsedTime={0} status="blue" />);
      expect(screen.queryByText(/phase/i)).not.toBeInTheDocument();
    });
  });
});

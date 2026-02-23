import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NavTabs from './NavTabs';

describe('NavTabs', () => {
  it('renders all three tabs: LIVE, AGENDA, REPORT', () => {
    render(<NavTabs activeTab="live" onTabChange={vi.fn()} />);

    expect(screen.getByText('LIVE')).toBeInTheDocument();
    expect(screen.getByText('AGENDA')).toBeInTheDocument();
    expect(screen.getByText('REPORT')).toBeInTheDocument();
  });

  it('applies active styling class to the active tab', () => {
    render(<NavTabs activeTab="agenda" onTabChange={vi.fn()} />);

    const agendaTab = screen.getByText('AGENDA');
    expect(agendaTab).toHaveClass('text-blue-600');

    // Inactive tabs should not have the active class
    expect(screen.getByText('LIVE')).not.toHaveClass('text-blue-600');
    expect(screen.getByText('REPORT')).not.toHaveClass('text-blue-600');
  });

  it('calls onTabChange with "live" when the LIVE tab is clicked', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<NavTabs activeTab="agenda" onTabChange={onTabChange} />);

    await user.click(screen.getByText('LIVE'));

    expect(onTabChange).toHaveBeenCalledTimes(1);
    expect(onTabChange).toHaveBeenCalledWith('live');
  });

  it('calls onTabChange with "agenda" when the AGENDA tab is clicked', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<NavTabs activeTab="live" onTabChange={onTabChange} />);

    await user.click(screen.getByText('AGENDA'));

    expect(onTabChange).toHaveBeenCalledTimes(1);
    expect(onTabChange).toHaveBeenCalledWith('agenda');
  });

  it('calls onTabChange with "report" when the REPORT tab is clicked', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<NavTabs activeTab="live" onTabChange={onTabChange} />);

    await user.click(screen.getByText('REPORT'));

    expect(onTabChange).toHaveBeenCalledTimes(1);
    expect(onTabChange).toHaveBeenCalledWith('report');
  });
});

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import SpeakerInput from './SpeakerInput';

// Stubbed rather than imported: the real module pulls in @zoom/appssdk, which
// hangs vitest under jsdom.
vi.mock('../utils/zoomSdk', () => ({ getZoomParticipants: vi.fn(() => Promise.resolve([])) }));

const ROLES = ['Standard Speech', 'Table Topics'];

/**
 * Renders with the value controlled the way LiveTab controls it, so typing
 * behaves as it does in the app rather than against a frozen prop.
 */
function renderInput(overrides = {}) {
  const props = {
    onAddSpeaker: vi.fn(),
    onRenameSpeaker: vi.fn(),
    onSelectSuggestion: vi.fn(),
    onRoleChange: vi.fn(),
    onEditRules: vi.fn(),
    agendaItems: [],
    activeSpeakerId: null,
    selectedRole: 'Standard Speech',
    roleOptions: ROLES,
    ...overrides,
  };

  function Harness() {
    const [value, setValue] = useState(props.value || '');
    return <SpeakerInput {...props} value={value} onChange={setValue} />;
  }

  render(<Harness />);
  return props;
}

const field = () => screen.getByPlaceholderText('Type speaker name...');

describe('SpeakerInput', () => {
  it('adds a typed name to the agenda on Enter', async () => {
    const user = userEvent.setup();
    const { onAddSpeaker } = renderInput();

    await user.type(field(), 'Priya');
    expect(await screen.findByText('Enter to add "Priya" to the agenda')).toBeInTheDocument();

    await user.keyboard('{Enter}');
    expect(onAddSpeaker).toHaveBeenCalledWith('Priya');
  });

  it('renames the active agenda speaker instead of adding a second one', async () => {
    const user = userEvent.setup();
    // Correcting a name mid-meeting must fix the running order, not fork it.
    const { onAddSpeaker, onRenameSpeaker } = renderInput({
      agendaItems: [{ id: 'a1', name: 'Jon', role: 'Standard Speech' }],
      activeSpeakerId: 'a1',
      value: 'Jon',
    });

    await user.type(field(), 'athan');
    await user.keyboard('{Enter}');

    expect(onRenameSpeaker).toHaveBeenCalledWith('a1', 'Jonathan');
    expect(onAddSpeaker).not.toHaveBeenCalled();
  });

  it('offers neither when the typed name is already on the agenda', async () => {
    const user = userEvent.setup();
    const { onAddSpeaker } = renderInput({
      agendaItems: [{ id: 'a1', name: 'Priya', role: 'Standard Speech' }],
    });

    await user.type(field(), 'Priya');
    await user.keyboard('{Enter}');

    expect(onAddSpeaker).not.toHaveBeenCalled();
    expect(screen.queryByText(/Enter to add/)).not.toBeInTheDocument();
  });

  it('lets a highlighted suggestion win over the typed text', async () => {
    const user = userEvent.setup();
    // Arrowing to a name is an explicit choice; the typed text is only a partial
    // match for it, so Enter must pick rather than add.
    const { onAddSpeaker, onSelectSuggestion } = renderInput({
      agendaItems: [{ id: 'a1', name: 'Priya', role: 'Standard Speech', completed: false }],
    });

    await user.type(field(), 'Pri');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onSelectSuggestion).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }));
    expect(onAddSpeaker).not.toHaveBeenCalled();
  });

  it('can add the same name again once that speaker has finished', async () => {
    const user = userEvent.setup();
    // A completed item is history, not a running order: the same person is often
    // back on later as an evaluator.
    const { onAddSpeaker } = renderInput({
      agendaItems: [{ id: 'a1', name: 'Priya', role: 'Standard Speech', completed: true }],
    });

    await user.type(field(), 'Priya');
    await user.keyboard('{Enter}');

    expect(onAddSpeaker).toHaveBeenCalledWith('Priya');
  });

  it('commits on a click as well, for anyone already reaching for the list', async () => {
    const user = userEvent.setup();
    const { onAddSpeaker } = renderInput();

    await user.type(field(), 'Priya');
    await user.click(await screen.findByText('Enter to add "Priya" to the agenda'));

    expect(onAddSpeaker).toHaveBeenCalledWith('Priya');
  });
});

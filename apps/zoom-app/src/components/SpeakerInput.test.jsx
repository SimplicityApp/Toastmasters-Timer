import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import SpeakerInput from './SpeakerInput';
import { getZoomParticipants } from '../utils/zoomSdk';

// Stubbed rather than imported: the real module pulls in @zoom/appssdk, which
// hangs vitest under jsdom.
vi.mock('../utils/zoomSdk', () => ({ getZoomParticipants: vi.fn() }));

// Default to the shape a host sees. Kept faithful to the real return value: a
// stub that answers with a bare array would let the component read `.participants`
// off it as undefined and still pass.
beforeEach(() => {
  getZoomParticipants.mockResolvedValue({ participants: [], role: 'host', restricted: false });
});

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

describe('SpeakerInput participant list', () => {
  it('offers everyone in the meeting, the organizer included', async () => {
    const user = userEvent.setup();
    getZoomParticipants.mockResolvedValue({
      participants: [{ id: 'me', name: 'Priya' }, { id: 'p2', name: 'Sam' }],
      role: 'host',
      restricted: false,
    });
    renderInput();

    await user.click(field());

    expect(await screen.findByText('Priya')).toBeInTheDocument();
    expect(screen.getByText('Sam')).toBeInTheDocument();
    // A host has nothing to act on, so the note stays out of their way.
    expect(screen.queryByText(/host or co-host/i)).not.toBeInTheDocument();
  });

  it('labels the group even when it is the only one', async () => {
    const user = userEvent.setup();
    // Where a name came from decides what picking it does, so a single unlabelled
    // list of names left the organizer guessing at that — and the common case is
    // exactly one group: a club with no agenda imported, or one running from an
    // agenda before anyone has joined.
    getZoomParticipants.mockResolvedValue({
      participants: [{ id: 'p2', name: 'Sam' }],
      role: 'host',
      restricted: false,
    });
    renderInput();

    await user.click(field());

    expect(await screen.findByText('Zoom Participants')).toBeInTheDocument();
    expect(screen.queryByText('Agenda')).not.toBeInTheDocument();
  });

  it('labels an agenda-only list too', async () => {
    const user = userEvent.setup();
    renderInput({ agendaItems: [{ id: 'a1', name: 'Priya', role: 'Standard Speech' }] });

    await user.click(field());

    expect(await screen.findByText('Agenda')).toBeInTheDocument();
    expect(screen.queryByText('Zoom Participants')).not.toBeInTheDocument();
  });

  it('offers someone on both lists as their agenda entry', async () => {
    const user = userEvent.setup();
    // The agenda entry carries a role and a place in the running order; the
    // participant is a bare name. Offering the name instead used to drop the
    // link to the agenda, so finishing could not advance and the item was never
    // ticked off.
    getZoomParticipants.mockResolvedValue({
      participants: [{ id: 'p1', name: 'priya' }, { id: 'p2', name: 'Sam' }],
      role: 'host',
      restricted: false,
    });
    const { onSelectSuggestion } = renderInput({
      agendaItems: [{ id: 'a1', name: 'Priya', role: 'Table Topics' }],
    });

    await user.click(field());

    expect(await screen.findByText('Agenda')).toBeInTheDocument();
    // Once, under Agenda — not a second time as a name off the meeting.
    expect(screen.getAllByText(/priya/i)).toHaveLength(1);

    await user.click(screen.getByText('Priya'));
    expect(onSelectSuggestion).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }));
  });

  it('tells a non-host why the list is short', async () => {
    const user = userEvent.setup();
    getZoomParticipants.mockResolvedValue({
      participants: [{ id: 'me', name: 'Priya' }],
      role: 'attendee',
      restricted: true,
    });
    renderInput();

    await user.click(field());

    // Their own name still comes through, so the list is never simply empty.
    expect(await screen.findByText('Priya')).toBeInTheDocument();
    expect(screen.getByText(/Ask to be made host or co-host/i)).toBeInTheDocument();
  });

  it('leaves a non-host free to type names as usual', async () => {
    // Non-intrusive has to mean non-blocking: the note sits at the foot of the
    // list and changes nothing about entering a name by hand.
    const user = userEvent.setup();
    getZoomParticipants.mockResolvedValue({
      participants: [{ id: 'me', name: 'Priya' }],
      role: 'attendee',
      restricted: true,
    });
    const { onAddSpeaker } = renderInput();

    await user.type(field(), 'Dana');
    await user.keyboard('{Enter}');

    expect(onAddSpeaker).toHaveBeenCalledWith('Dana');
  });
});

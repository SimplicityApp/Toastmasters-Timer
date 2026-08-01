import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import StageSpeakerPicker from './StageSpeakerPicker';
import { getZoomParticipants } from '../utils/zoomSdk';

// Stubbed rather than imported: the real module pulls in @zoom/appssdk, which
// hangs vitest under jsdom.
vi.mock('../utils/zoomSdk', () => ({ getZoomParticipants: vi.fn() }));

beforeEach(() => {
  getZoomParticipants.mockResolvedValue({ participants: [], role: 'host', restricted: false });
});

function renderPicker(overrides = {}) {
  const props = {
    role: 'Table Topics',
    agendaItems: [],
    activeSpeakerId: null,
    onSelectSpeaker: vi.fn(),
    onAddSpeaker: vi.fn(),
    onRenameSpeaker: vi.fn(),
    ...overrides,
  };

  function Harness() {
    const [value, setValue] = useState(props.value || '');
    return <StageSpeakerPicker {...props} value={value} onChange={setValue} />;
  }

  render(<Harness />);
  return props;
}

const openMenu = async (user) =>
  user.click(await screen.findByLabelText('Choose a speaker from the agenda or the meeting'));

describe('StageSpeakerPicker', () => {
  it('offers the meeting when there is no agenda to move around in', async () => {
    const user = userEvent.setup();
    // The stage is where typing is hardest — it may be on a shared screen — and a
    // club running Table Topics off no agenda had no list here at all, while Zoom
    // already knew everyone's name.
    getZoomParticipants.mockResolvedValue({
      participants: [{ id: 'p1', name: 'Priya' }, { id: 'p2', name: 'Sam' }],
      role: 'host',
      restricted: false,
    });
    const { onAddSpeaker } = renderPicker();

    await openMenu(user);

    expect(await screen.findByText('Zoom Participants')).toBeInTheDocument();
    await user.click(screen.getByText('Sam'));

    // Adding is what Enter already does with a typed name, and the only outcome
    // that puts the meeting on a running order the report can follow.
    expect(onAddSpeaker).toHaveBeenCalledWith('Sam');
  });

  it('labels both groups, and each on its own', async () => {
    const user = userEvent.setup();
    getZoomParticipants.mockResolvedValue({
      participants: [{ id: 'p2', name: 'Sam' }],
      role: 'host',
      restricted: false,
    });
    renderPicker({
      agendaItems: [
        { id: 'a1', name: 'Priya', role: 'Standard Speech' },
        { id: 'a2', name: 'Dana', role: 'Evaluation' },
      ],
    });

    await openMenu(user);

    expect(await screen.findByText('Agenda')).toBeInTheDocument();
    expect(screen.getByText('Zoom Participants')).toBeInTheDocument();
  });

  it('leaves someone already on the agenda out of the meeting group', async () => {
    const user = userEvent.setup();
    getZoomParticipants.mockResolvedValue({
      participants: [{ id: 'p1', name: 'priya ' }],
      role: 'host',
      restricted: false,
    });
    renderPicker({
      agendaItems: [
        { id: 'a1', name: 'Priya', role: 'Standard Speech' },
        { id: 'a2', name: 'Dana', role: 'Evaluation' },
      ],
    });

    await openMenu(user);

    // Their agenda entry carries a role and a place in the order; the bare name
    // would be the worse of the two to offer alongside it.
    expect(await screen.findByText('Agenda')).toBeInTheDocument();
    expect(screen.queryByText('Zoom Participants')).not.toBeInTheDocument();
    expect(screen.getAllByText(/priya/i)).toHaveLength(1);
  });

  it('picks an agenda speaker by their place in the order', async () => {
    const user = userEvent.setup();
    const { onSelectSpeaker } = renderPicker({
      agendaItems: [
        { id: 'a1', name: 'Priya', role: 'Standard Speech' },
        { id: 'a2', name: 'Dana', role: 'Evaluation' },
      ],
      activeSpeakerId: 'a1',
    });

    await openMenu(user);
    await user.click(await screen.findByText('Dana'));

    expect(onSelectSpeaker).toHaveBeenCalledWith('a2');
  });

  it('offers no dropdown when there is nowhere to go', async () => {
    renderPicker({ agendaItems: [{ id: 'a1', name: 'Priya', role: 'Standard Speech' }] });

    expect(await screen.findByLabelText('Speaker name')).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Choose a speaker from the agenda or the meeting')
    ).not.toBeInTheDocument();
  });
});

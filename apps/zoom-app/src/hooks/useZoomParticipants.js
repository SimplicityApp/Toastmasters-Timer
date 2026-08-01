import { useEffect, useState } from 'react';
import { getZoomParticipants } from '../utils/zoomSdk';

/**
 * Everyone in the meeting, as the client will report them.
 *
 * Shared by the panel field and the stage picker rather than fetched in each:
 * the two places an organizer names a speaker should offer the same people, and
 * the list should not be fetched twice with two chances to disagree.
 *
 * Fetched once per mount. The names are only ever suggestions — a stale list
 * costs a suggestion, never a typed name — so there is no polling.
 *
 * @returns {{participants: Array<{id: string, name: string}>, restricted: boolean}}
 *   restricted is true only when the list was withheld because the organizer is
 *   not host or co-host — the one cause they can actually do something about.
 */
export default function useZoomParticipants() {
  const [state, setState] = useState({ participants: [], restricted: false });

  useEffect(() => {
    let cancelled = false;
    getZoomParticipants().then((result) => {
      if (cancelled) return;
      setState({
        participants: result?.participants || [],
        restricted: Boolean(result?.restricted),
      });
    });
    return () => { cancelled = true; };
  }, []);

  return state;
}

/**
 * How a name is compared across the two lists. The agenda is typed by hand and
 * the participant list comes from Zoom, so casing and stray spaces differ
 * routinely for what is plainly the same person.
 * @param {string} [name]
 * @returns {string}
 */
export function nameKey(name) {
  return (name || '').trim().toLowerCase();
}

/**
 * The people in the meeting who are not already on the running order.
 *
 * The agenda entry wins wherever both have someone, because it carries a role
 * and a place in the order while a participant is only a name. Suggesting the
 * bare name alongside it would offer the organizer the worse of the two.
 *
 * @param {Array<{id: string, name: string}>} participants
 * @param {Array<{name?: string, completed?: boolean}>} agendaItems - Items to
 *   treat as already covered; pass the ones actually being offered.
 * @returns {Array<{id: string, name: string}>}
 */
export function participantsNotOnAgenda(participants, agendaItems) {
  const onAgenda = new Set((agendaItems || []).map((item) => nameKey(item.name)).filter(Boolean));
  return (participants || []).filter((person) => !onAgenda.has(nameKey(person.name)));
}

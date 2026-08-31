import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { trackEvent } from '../utils/posthog'
import YouTubePlayer from '../components/YouTubePlayer'

const ZOOM_APP_URL = 'https://marketplace.zoom.us/zoomapp/DsFHK5sNQs2_VFyeQky2sg/context/meeting/target/launch/deeplink'

/**
 * A tutorial screenshot.
 *
 * Until the file is dropped into apps/web/public/zoom/tutorial/, the image fails
 * to load and this falls back to a labelled box naming the file it wants. That
 * way the page never shows a broken image icon, and adding a screenshot is just
 * copying a file into place with no code change.
 */
function Shot({ src, alt, hint, onZoom }) {
  const [missing, setMissing] = useState(false)

  if (missing) {
    return (
      <div className="w-full aspect-video rounded-xl border-2 border-dashed border-white/25 bg-white/5 flex flex-col items-center justify-center text-center px-4 py-6">
        <span className="text-sm font-medium text-gray-300">Screenshot coming soon</span>
        <span className="mt-1 text-xs text-gray-400">{hint}</span>
        <code className="mt-2 text-[11px] text-gray-500 break-all">{src}</code>
      </div>
    )
  }

  // A button, not an img with a click handler: these shots carry the detail the
  // text is describing, and at half the page width that detail is too small to
  // read. Enlarging has to be reachable by keyboard for the same reason it is
  // worth offering at all.
  return (
    <button
      type="button"
      onClick={() => onZoom({ src, alt })}
      className="group relative block w-full cursor-zoom-in rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      aria-label={`Enlarge screenshot: ${alt}`}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setMissing(true)}
        // Same box as the placeholder, so nothing shifts when a screenshot lands
        // and a shot that is not quite 16:9 is letterboxed rather than cropped.
        className="w-full aspect-video object-contain rounded-xl border border-white/15 bg-white/5 shadow-lg shadow-black/30 transition-transform duration-200 group-hover:scale-[1.02]"
      />
    </button>
  )
}

/**
 * The enlarged screenshot.
 *
 * Closes on Escape, on the backdrop and on the button, because someone who
 * opened this by accident should not have to hunt for the way out. Body scroll
 * is frozen while it is open so dismissing it returns them to the same place on
 * the page they left.
 */
function Lightbox({ shot, onClose }) {
  useEffect(() => {
    if (!shot) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [shot, onClose])

  if (!shot) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={shot.alt}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 cursor-zoom-out"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 rounded-lg bg-white/10 hover:bg-white/20 p-2 text-white transition-colors"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>
      {/* Stops a click on the picture itself from closing what it just opened. */}
      <img
        src={shot.src}
        alt={shot.alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full object-contain rounded-lg shadow-2xl cursor-default"
      />
    </div>
  )
}

// Screenshots to capture in the Zoom app, one per step.
const TUTORIAL_STEPS = [
  {
    title: 'Open the app in your meeting',
    body: 'Add the app to Zoom once. After that it sits in the Apps panel of every meeting, so you can open it as soon as you join.',
    src: '/zoom/tutorial/01-open-in-meeting.jpg',
    hint: 'Zoom meeting with the Apps panel open and the timer showing',
  },
  {
    title: 'Load your agenda',
    body: 'Paste your list of speakers, or paste the meeting page straight from EasySpeak. Every speaker comes in with the right role and time limits, and you can drag them into order.',
    src: '/zoom/tutorial/02-agenda-import.jpg',
    hint: 'Agenda tab with the import box and a filled agenda',
  },
  {
    title: 'Pick how the timer shows up',
    body: 'Open the mode menu at the top of the Live tab. It names the mode you are in, and holds the three above. You can switch at any point, even in the middle of a meeting.',
    src: '/zoom/tutorial/03-mode-menu.jpg',
    hint: 'Live tab with the display mode menu open, showing all three modes',
  },
  {
    title: 'Name the speaker',
    body: 'Pick whoever is up next from your agenda, or straight from the people in the meeting. Someone who is not on the list? Type their name and press Enter to add them. Type over a name and press Enter to fix a spelling, and they keep their place in the running order.',
    src: '/zoom/tutorial/04-speaker-name.jpg',
    hint: 'Speaker name field with the suggestion list open, showing agenda names and people in the meeting',
  },
  {
    title: 'Run the timer',
    body: 'Press START when the speaker begins. Green, yellow and red come up on their own at your club times. Press FINISH to save the time and load the next speaker.',
    src: '/zoom/tutorial/05-live-controls.jpg',
    hint: 'Live tab mid speech, timer running with the green signal up',
  },
  {
    title: 'Share the report',
    body: 'The Report tab lists every speaker with their time and whether they were inside the limits. One click copies it, ready to paste into the meeting chat.',
    src: '/zoom/tutorial/06-report.jpg',
    hint: 'Report tab with a few finished speeches and the copy button',
  },
]

// The three display modes. This is the part clubs ask about most, so each one
// gets its own picture and a plain line about who it suits.
const DISPLAY_MODES = [
  {
    name: 'Timer Stage',
    body: 'The timer fills the whole app panel in full color. Your camera is left alone. From the stage you can share it to the meeting so everyone sees the same signal, or pop it out into its own window and park it on a second screen.',
    bestFor: 'Best for clubs who want one timer everybody can see.',
    src: '/zoom/tutorial/mode-stage.jpg',
    hint: 'Timer Stage open in green, with the share and pop out buttons visible',
  },
  {
    name: 'Timer Card',
    body: 'Your video tile turns into the color card. Your camera stays on but the picture is replaced, so your tile becomes one big green, yellow or red signal in the gallery.',
    bestFor: 'Best for the classic look, where speakers watch the timer’s tile.',
    src: '/zoom/tutorial/mode-card.jpg',
    hint: 'Zoom gallery view with the timer tile showing a yellow card',
  },
  {
    name: 'Timer + Camera',
    body: 'The color sits behind you as a virtual background. Speakers see your face and the color at the same time.',
    bestFor: 'Best for timers who also want to be seen, for nods and hand signals.',
    src: '/zoom/tutorial/mode-camera.jpg',
    hint: 'Timer on camera with a red background behind their face',
  },
]

// Small options that are easy to miss but change how a meeting feels.
const TIPS = [
  {
    title: 'Hide the countdown',
    body: 'On the Timer Stage, the eye icon hides the clock. Speakers then read only the color, the way they would read timing cards in the room. You still see the numbers and the controls.',
    src: '/zoom/tutorial/tip-hide-clock.jpg',
    hint: 'Timer Stage with the clock hidden, eye icon highlighted',
  },
  {
    title: 'Show my own background between speeches',
    body: 'In the two video modes, your normal camera comes back the moment a speech ends and the color returns when the next one starts. Zoom asks you to confirm each switch. Turn it off if you would rather keep the color up all meeting.',
    src: '/zoom/tutorial/tip-reveal-face.jpg',
    hint: 'Mode menu with the "Show my own background" checkbox',
  },
  {
    title: 'Clear the timer from your video',
    body: 'Clear Background takes the timer off your video and puts your camera back the way it was. RESET does the same on its way to zeroing the clock, so this is the one to reach for when you hand the role to someone else, or if anything looks stuck.',
    src: '/zoom/tutorial/tip-clear-video.jpg',
    hint: 'Live tab with the Clear Background button',
  },
]

// Clubs we know are running their meetings with the timer, from the in-app club
// survey and direct conversations. Add a club here as soon as it confirms —
// name it exactly the way the club names itself.
const TRUSTED_CLUBS = [
  { name: 'Jacaranda Chinese English Toastmasters', place: 'District 129' },
  { name: 'Women LEAD Toastmasters', place: 'District 101' },
  { name: 'Sapphire City Toastmasters', place: 'District 70' },
  { name: 'Malabar Toastmasters', place: 'Calicut, India' },
  // Placeholders — swap in real clubs as they confirm.
  { name: 'Your Club Here', place: 'Anywhere in the world', placeholder: true },
]

/**
 * The rolling "Trusted by" strip.
 *
 * The track renders the club list twice and slides one copy's width before
 * restarting, which reads as an endless loop. The second copy is decoration, so
 * it is hidden from screen readers; they get the list once, in order. Hovering
 * pauses the roll, and prefers-reduced-motion stops it entirely (the CSS side
 * of this lives in index.css next to the keyframes).
 */
function TrustedBy() {
  const chips = (hidden) => (
    <ul
      aria-hidden={hidden || undefined}
      className="flex items-center gap-4 pr-4 flex-shrink-0"
    >
      {TRUSTED_CLUBS.map((club) => (
        <li
          key={club.name}
          className={`flex flex-col items-center whitespace-nowrap rounded-xl border px-5 py-3 ${
            club.placeholder
              ? 'border-dashed border-white/25 bg-white/5'
              : 'border-white/15 bg-white/10'
          }`}
        >
          <span className={`text-sm font-medium ${club.placeholder ? 'text-gray-400' : 'text-white'}`}>
            {club.name}
          </span>
          <span className="text-xs text-gray-400">{club.place}</span>
        </li>
      ))}
    </ul>
  )

  return (
    <section
      aria-label="Clubs using Toastmasters Timer"
      className="rounded-2xl bg-black/30 backdrop-blur-md border border-white/10 shadow-2xl shadow-black/20 px-6 py-6 -mt-6 mb-12"
    >
      <p className="text-center text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
        Trusted by Toastmasters clubs worldwide
      </p>
      <div className="overflow-hidden" style={{ maskImage: 'linear-gradient(90deg, transparent, black 8%, black 92%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, black 8%, black 92%, transparent)' }}>
        <div className="flex w-max animate-marquee">
          {chips(false)}
          {chips(true)}
        </div>
      </div>
    </section>
  )
}

/**
 * John's portrait, with the same graceful fallback the tutorial screenshots
 * use: until the photo lands in apps/web/public/people/, show his initials
 * instead of a broken image, so shipping the section never waits on the file.
 */
function AmbassadorPhoto() {
  const [missing, setMissing] = useState(false)

  if (missing) {
    return (
      <div
        aria-hidden
        className="h-28 w-28 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 ring-2 ring-white/30 shadow-lg flex items-center justify-center flex-shrink-0"
      >
        <span className="text-3xl font-semibold text-white">JC</span>
      </div>
    )
  }

  return (
    <img
      src="/people/john-christensen.jpg"
      alt="John Christensen"
      loading="lazy"
      onError={() => setMissing(true)}
      // Anchored to the photo's bottom: it's a portrait selfie with open sky in
      // the top half, so a centered crop shows sky where the face should be.
      className="h-28 w-28 rounded-full object-cover object-bottom ring-2 ring-white/30 shadow-lg flex-shrink-0"
    />
  )
}

// The rail's entries, in the order the sections appear. Kept next to the page
// rather than derived from the DOM so the labels can be shorter than the
// headings they point at — "Tutorial" reads better in a narrow rail than "How to
// Use the Timer in Zoom".
const NAV_SECTIONS = [
  { id: 'top', label: 'Overview' },
  { id: 'ambassador', label: 'Ambassador' },
  { id: 'features', label: 'Features' },
  { id: 'display-modes', label: 'Three Ways' },
  { id: 'tips', label: 'Worth Knowing' },
  { id: 'how-to-zoom', label: 'Tutorial' },
  { id: 'demos', label: 'Demos' },
  { id: 'timer-role', label: 'Timer Role' },
]

/**
 * The section rail down the left of the page.
 *
 * Follows the scroll by being fixed rather than sticky: the page content is a
 * centered max-w-4xl column, and a sticky rail inside that column would either
 * eat into the reading width or knock the column off center. Fixed and outside
 * the column, it costs the content nothing.
 *
 * Only appears from xl up, where there is empty gutter to put it in. Below that
 * the page is short enough on headings that scrolling is no hardship, and a rail
 * would sit on top of the text.
 */
function SectionRail() {
  const [activeId, setActiveId] = useState(NAV_SECTIONS[0].id)

  useEffect(() => {
    // The heading nearest the top of the viewport wins, so the rail marks the
    // section you are reading rather than whichever one happens to be biggest.
    // An IntersectionObserver would flip on the section leaving the bottom of a
    // tall viewport; measuring against a line near the top does not.
    const ACTIVE_LINE = 140
    let frame = 0

    const update = () => {
      frame = 0
      let current = NAV_SECTIONS[0].id
      for (const section of NAV_SECTIONS) {
        const el = document.getElementById(section.id)
        if (!el) continue
        if (el.getBoundingClientRect().top <= ACTIVE_LINE) current = section.id
      }
      // At the very bottom the last section may never cross the line — for
      // instance when it is shorter than the space left below it — so claim it.
      const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 2
      if (atBottom) current = NAV_SECTIONS[NAV_SECTIONS.length - 1].id
      setActiveId(current)
    }

    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    // The rail wears the same blurred dark card the page's sections do. Without
    // it the rail sits straight on the cover photo, and the labels are only as
    // legible as whatever part of the picture happens to be behind them.
    <nav
      aria-label="Page sections"
      className="hidden xl:block fixed left-6 top-1/2 -translate-y-1/2 z-20 rounded-2xl bg-black/30 backdrop-blur-md border border-white/10 shadow-2xl shadow-black/20 px-4 py-4"
    >
      <ul className="relative border-l border-white/15 pl-4 space-y-1">
        {NAV_SECTIONS.map((section) => {
          const isActive = section.id === activeId
          return (
            <li key={section.id} className="relative">
              {/* The rail's marker: a segment of the track lit up beside the
                  current section, rather than a dot, so the line itself reads
                  as a progress indicator. */}
              <span
                aria-hidden
                className={`absolute -left-4 top-1/2 -translate-y-1/2 h-6 w-px transition-colors duration-200 ${
                  isActive ? 'bg-blue-400' : 'bg-transparent'
                }`}
              />
              <a
                href={`#${section.id}`}
                aria-current={isActive ? 'true' : undefined}
                className={`block py-1 text-sm transition-colors ${
                  isActive ? 'text-white font-medium' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {section.label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export default function Landing() {
  const ADD_TO_ZOOM_URL = import.meta.env.VITE_ZOOM_OAUTH_REDIRECT
  // The screenshot being viewed full size, or null. One at a time, so it lives
  // here rather than in each Shot.
  const [zoomedShot, setZoomedShot] = useState(null)
  return (
    <div
      className="min-h-screen relative bg-gray-900"
      style={{
        backgroundImage: 'url(/Toastmasters-Timer-cover-page.png)',
        backgroundSize: 'cover',
        backgroundPosition: '80% center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Light overlay so cover stays visible; cards provide their own contrast */}
      <div className="absolute inset-0 bg-black/35" aria-hidden />

      <header className="relative z-10 bg-black/25 backdrop-blur-md border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <img
            src="/Toastmasters-Timer-logo.jpg"
            alt="Toastmasters Timer app logo"
            className="h-10 w-10 rounded-xl object-cover shadow-sm ring-1 ring-white/20"
          />
          <span className="text-xl font-semibold text-white">Toastmasters Timer</span>
        </div>
      </header>

      <SectionRail />

      <main className="relative z-10 max-w-4xl mx-auto px-4">
        <section id="top" className="relative overflow-hidden rounded-2xl mt-6 mb-12 bg-black/30 backdrop-blur-md border border-white/10 shadow-2xl shadow-black/20">
          <div
            className="h-1.5 w-full rounded-full opacity-90"
            style={{
              background: 'linear-gradient(90deg, #22c55e 0%, #eab308 50%, #dc2626 100%)',
              boxShadow: '0 0 20px rgba(34, 197, 94, 0.3), 0 0 40px rgba(234, 179, 8, 0.2), 0 0 20px rgba(220, 38, 38, 0.3)',
            }}
          />
          <div className="relative px-6 py-10 sm:py-12 text-center">
            <img
              src="/Toastmasters-Timer-logo.jpg"
              alt=""
              className="mx-auto h-24 w-24 rounded-2xl object-cover shadow-lg ring-2 ring-white/30"
              aria-hidden
            />
            <h1 className="mt-6 text-3xl font-bold text-white">
              Free Online Toastmasters Speech Timer – Run the Timer Role Easily
            </h1>
            <p className="mt-3 text-lg text-gray-300 max-w-2xl mx-auto">
              Toastmasters Timer helps you run the Timer role in Toastmasters meetings. Use it in your browser or add it to Zoom for automatic virtual backgrounds.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={ADD_TO_ZOOM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 shadow-lg shadow-blue-900/40 transition-all"
              >
                Add to Zoom
              </a>
              <Link
                to="/app"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-white/30 bg-white/10 text-white font-medium hover:bg-white/20 backdrop-blur-sm transition-all"
              >
                Use in Browser
              </Link>
            </div>
            <p className="mt-5 text-sm text-gray-400">
              Already use the Zoom app?{' '}
              <a href={ZOOM_APP_URL} className="text-blue-300 hover:text-blue-200 font-medium">Open in Zoom</a>
            </p>
          </div>
        </section>

        <TrustedBy />

        {/* Directly under the club strip on purpose: the clubs and John are one
            social-proof block — "clubs run it, and a seasoned Toastmaster vouches
            for it" — best read together, before the feature pitch. */}
        <section id="ambassador" className="scroll-mt-6 rounded-2xl bg-black/30 backdrop-blur-md border border-white/10 shadow-2xl shadow-black/20 px-6 py-8">
          <h2 className="text-lg font-semibold text-white mb-6">Our Founding Ambassador</h2>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <AmbassadorPhoto />
            <div className="text-center sm:text-left">
              <h3 className="text-xl font-semibold text-white">John Christensen</h3>
              <p className="mt-1 text-sm font-medium text-blue-300">
                Founding Ambassador &middot; Toastmasters Area Director
              </p>
              <p className="mt-3 text-gray-300 text-sm leading-relaxed">
                John is a member of more than twenty Toastmasters clubs around the world, from
                San Diego to the UK to Phnom Penh. As an Area Director he has introduced the
                timer to clubs across his area and beyond, and dozens of his suggestions have
                shaped the app you see today.
              </p>
              <blockquote className="mt-4 border-l-2 border-blue-400 pl-4 text-gray-200 italic">
                &ldquo;Everyone is praising the timer on the screen.&rdquo;
              </blockquote>
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-6 rounded-2xl bg-black/30 backdrop-blur-md border border-white/10 shadow-2xl shadow-black/20 px-6 py-8 mt-6">
          <h3 className="text-lg font-semibold text-white mb-4">Features</h3>
          <ul className="space-y-3 text-gray-300">
            <li className="flex items-start gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
              Timing rules for speeches (Standard Speech, Short Roles, Table Topics, evaluations, etc.)
            </li>
            <li className="flex items-start gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
              Agenda and reports to track speakers
            </li>
            <li className="flex items-start gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-yellow-500 mt-1.5 flex-shrink-0" />
              Quick import: paste meeting roles and load the agenda
            </li>
            <li className="flex items-start gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
              In browser: the page background changes color (green, yellow, red) as time runs
            </li>
            <li className="flex items-start gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
              In Zoom: three display modes, including a full-size timer you can share to the whole meeting
            </li>
            <li className="flex items-start gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
              In Zoom: virtual backgrounds change automatically, and your own camera comes back between speeches
            </li>
          </ul>
        </section>

        {/* Ahead of the step-by-step on purpose. This section answers "what will
            this look like in my meeting?", which is the question a club has
            before installing anything; the steps answer "how do I drive it?",
            which only matters once they have decided. Three cards also scan in
            a fraction of the space six steps take. */}
        <section id="display-modes" className="scroll-mt-6 rounded-2xl bg-black/30 backdrop-blur-md border border-white/10 shadow-2xl shadow-black/20 px-6 py-8 mt-6">
          <h2 className="text-lg font-semibold text-white mb-2">Three Ways to Show the Timer</h2>
          <p className="text-gray-300 mb-6">
            Pick the one that fits your club. Switching modes takes one click, and the app remembers your choice for next time.
          </p>

          <div className="grid gap-6 sm:grid-cols-3">
            {DISPLAY_MODES.map((mode) => (
              <div key={mode.name}>
                <Shot src={mode.src} alt={`${mode.name} mode in Zoom`} hint={mode.hint} onZoom={setZoomedShot} />
                <h3 className="mt-3 text-base font-semibold text-white">{mode.name}</h3>
                <p className="mt-1 text-sm text-gray-300 leading-relaxed">{mode.body}</p>
                <p className="mt-2 text-sm text-blue-300">{mode.bestFor}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Sits with the display modes, not after the steps: both answer "what
            will this look like in my meeting?", and these options are choices
            about the modes above. The steps below are the separate question of
            how to drive it. */}
        <section id="tips" className="scroll-mt-6 rounded-2xl bg-black/30 backdrop-blur-md border border-white/10 shadow-2xl shadow-black/20 px-6 py-8 mt-6">
          <h2 className="text-lg font-semibold text-white mb-2">Small Things Worth Knowing</h2>
          <p className="text-gray-300 mb-6">Options that are easy to miss and change how the meeting feels.</p>

          <div className="grid gap-6 sm:grid-cols-3">
            {TIPS.map((tip) => (
              <div key={tip.title}>
                <Shot src={tip.src} alt={tip.title} hint={tip.hint} onZoom={setZoomedShot} />
                <h3 className="mt-3 text-base font-semibold text-white">{tip.title}</h3>
                <p className="mt-1 text-sm text-gray-300 leading-relaxed">{tip.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how-to-zoom" className="scroll-mt-6 rounded-2xl bg-black/30 backdrop-blur-md border border-white/10 shadow-2xl shadow-black/20 px-6 py-8 mt-6">
          <h2 className="text-lg font-semibold text-white mb-2">How to Use the Timer in Zoom</h2>
          <p className="text-gray-300 mb-6">Six steps from joining the meeting to sharing the report.</p>

          <ol className="space-y-8">
            {TUTORIAL_STEPS.map((step, index) => (
              <li key={step.title} className="grid gap-4 sm:grid-cols-2 sm:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white flex-shrink-0">
                      {index + 1}
                    </span>
                    <h3 className="text-base font-semibold text-white">{step.title}</h3>
                  </div>
                  <p className="mt-2 text-gray-300 text-sm leading-relaxed">{step.body}</p>
                </div>
                <Shot src={step.src} alt={`Step ${index + 1}: ${step.title}`} hint={step.hint} onZoom={setZoomedShot} />
              </li>
            ))}
          </ol>
        </section>

        <section id="demos" className="scroll-mt-6 rounded-2xl bg-black/30 backdrop-blur-md border border-white/10 shadow-2xl shadow-black/20 px-6 py-8 mt-6">
          <h3 className="text-lg font-semibold text-white mb-4">Quick Demo: Using in Zoom</h3>
          <div className="rounded-xl overflow-hidden">
            <video
              src="/zoom/use-app-demo.mp4"
              preload="none"
              poster="/use-app-demo-poster.jpg"
              controls
              playsInline
              className="w-full rounded-xl"
              aria-label="Demo video showing Toastmasters Timer with Zoom virtual background color changes"
              onPlay={() => trackEvent('quick_demo_played', { page: 'landing' })}
            />
          </div>
          <a href="/toastmasters-timer-zoom-demo" className="inline-block mt-3 text-sm text-blue-300 hover:text-blue-200 transition-colors">Watch on dedicated page &rarr;</a>
        </section>

        <section className="rounded-2xl bg-black/30 backdrop-blur-md border border-white/10 shadow-2xl shadow-black/20 px-6 py-8 mt-6">
          <h3 className="text-lg font-semibold text-white mb-4">Watch the Full Product Demo</h3>
          <div className="rounded-xl overflow-hidden">
            <YouTubePlayer
              videoId="1VkED9sXE6Q"
              title="Toastmasters Timer – Product Demo"
              page="landing"
            />
          </div>
          <a href="/toastmasters-timer-demo" className="inline-block mt-3 text-sm text-blue-300 hover:text-blue-200 transition-colors">Watch on dedicated page &rarr;</a>
        </section>

        <section id="timer-role" className="scroll-mt-6 rounded-2xl bg-black/30 backdrop-blur-md border border-white/10 shadow-2xl shadow-black/20 px-6 py-8 mt-6">
          <h2 className="text-lg font-semibold text-white mb-3">What is the Timer Role in Toastmasters?</h2>
          <p className="text-gray-300 mb-4">
            The Timer is one of the most important meeting roles in Toastmasters. The Timer tracks how long each speaker talks and signals them using colored lights — green, yellow, and red — so they stay within their allotted time. Keeping speeches on time ensures the meeting runs smoothly and every speaker gets a fair chance to practice.
          </p>

          <h2 className="text-lg font-semibold text-white mb-3 mt-6">Standard Toastmasters Timing Rules</h2>
          <p className="text-gray-300 mb-3">
            Each speech type has its own time range. The timer shows green when the minimum time is reached, yellow at the midpoint, and red at the maximum. Speakers who finish before green or after red may be disqualified from awards.
          </p>
          <ul className="space-y-2 text-gray-300 text-sm">
            <li className="flex justify-between border-b border-white/10 pb-2">
              <span className="font-medium text-white">Standard Speech (5–7 min)</span>
              <span>🟢 5:00 &nbsp; 🟡 6:00 &nbsp; 🔴 7:00</span>
            </li>
            <li className="flex justify-between border-b border-white/10 pb-2">
              <span className="font-medium text-white">Table Topics (1–2 min)</span>
              <span>🟢 1:00 &nbsp; 🟡 1:30 &nbsp; 🔴 2:00</span>
            </li>
            <li className="flex justify-between border-b border-white/10 pb-2">
              <span className="font-medium text-white">Evaluation (2–3 min)</span>
              <span>🟢 2:00 &nbsp; 🟡 2:30 &nbsp; 🔴 3:00</span>
            </li>
            <li className="flex justify-between pb-2">
              <span className="font-medium text-white">Longer Speech (7–9 min)</span>
              <span>🟢 7:00 &nbsp; 🟡 8:00 &nbsp; 🔴 9:00</span>
            </li>
          </ul>
          <p className="text-gray-400 text-sm mt-4">
            Toastmasters Timer is pre-loaded with these rules so you can start timing immediately — no manual setup required.
          </p>
        </section>
      </main>

      <footer className="relative z-10 bg-black/30 backdrop-blur-md border-t border-white/10 mt-12 py-8 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Resources</h4>
            <ul className="space-y-2">
              <li><a href="/toastmasters-timer-role-guide" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Timer Role Guide</a></li>
              <li><a href="/toastmasters-timer-script" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Timer Script</a></li>
              <li><a href="/toastmasters-speech-types-and-timing" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Speech Types &amp; Timing</a></li>
              <li><a href="/toastmasters-timing-chart" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Timing Chart</a></li>
              <li><a href="/table-topics-timer" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Table Topics Timer</a></li>
              <li><a href="/toastmasters-speech-contest-timing-rules" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Contest Timing Rules</a></li>
              <li><a href="/how-to-use-zoom-for-toastmasters" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Zoom for Toastmasters</a></li>
              <li><a href="/toastmasters-zoom-timer-backgrounds" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Free Zoom Backgrounds</a></li>
              <li><a href="/best-toastmasters-timer-apps" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Timer Apps Compared</a></li>
              <li><a href="/toastmasters-timer-demo" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Product Demo</a></li>
              <li><a href="/toastmasters-timer-zoom-demo" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Zoom Demo</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Legal</h4>
            <ul className="space-y-2">
              <li><a href="/privacy" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Privacy Policy</a></li>
              <li><a href="/terms-of-use" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Terms of Use</a></li>
              <li><a href="/support" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Support</a></li>
              <li><a href="/documentation" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Documentation</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Get Started</h4>
            <ul className="space-y-2">
              <li><Link to="/app" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Start Timer</Link></li>
            </ul>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-8 text-center">&copy; 2026 Toastmasters Timer. Not affiliated with Toastmasters International.</p>
      </footer>

      <Lightbox shot={zoomedShot} onClose={() => setZoomedShot(null)} />
    </div>
  )
}

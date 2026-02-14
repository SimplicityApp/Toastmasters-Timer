import { Link } from 'react-router-dom'

const ZOOM_MARKETPLACE_URL = 'https://marketplace.zoom.us/apps/sWHvcm4YShyr6SXQQI8DFw'
const ZOOM_APP_URL = 'https://www.timer.simple-tech.app'

export default function Landing() {
  return (
    <div
      className="min-h-screen relative bg-gray-900"
      style={{
        backgroundImage: 'url(/landing/Toastmasters-Timer-cover-page.png)',
        backgroundSize: 'cover',
        backgroundPosition: '100% center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Light overlay so cover stays visible; cards provide their own contrast */}
      <div className="absolute inset-0 bg-black/35" aria-hidden />

      <header className="relative z-10 bg-black/25 backdrop-blur-md border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <img
            src="/landing/Toastmasters-Timer-logo.jpg"
            alt="Toastmaster Timer"
            className="h-10 w-10 rounded-xl object-cover shadow-sm ring-1 ring-white/20"
          />
          <h1 className="text-xl font-semibold text-white">Toastmaster Timer</h1>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-4">
        <section className="relative overflow-hidden rounded-2xl mt-6 mb-12 bg-black/30 backdrop-blur-md border border-white/10 shadow-2xl shadow-black/20">
          <div
            className="h-1.5 w-full rounded-full opacity-90"
            style={{
              background: 'linear-gradient(90deg, #22c55e 0%, #eab308 50%, #dc2626 100%)',
              boxShadow: '0 0 20px rgba(34, 197, 94, 0.3), 0 0 40px rgba(234, 179, 8, 0.2), 0 0 20px rgba(220, 38, 38, 0.3)',
            }}
          />
          <div className="relative px-6 py-10 sm:py-12 text-center">
            <img
              src="/landing/Toastmasters-Timer-logo.jpg"
              alt=""
              className="mx-auto h-24 w-24 rounded-2xl object-cover shadow-lg ring-2 ring-white/30"
              aria-hidden
            />
            <h2 className="mt-6 text-3xl font-bold text-white">
              Run the timer role easily
            </h2>
            <p className="mt-3 text-lg text-gray-300 max-w-2xl mx-auto">
              Toastmaster Timer helps you run the Timer role in Toastmasters meetings. Use it in your browser or add it to Zoom for virtual backgrounds.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/app"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 shadow-lg shadow-blue-900/40 transition-all"
              >
                Use in browser
              </Link>
              <a
                href={ZOOM_MARKETPLACE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-white/30 bg-white/10 text-white font-medium hover:bg-white/20 backdrop-blur-sm transition-all"
              >
                Add to Zoom
              </a>
            </div>
            <p className="mt-5 text-sm text-gray-400">
              Already use the Zoom app?{' '}
              <a href={ZOOM_APP_URL} className="text-blue-300 hover:text-blue-200 font-medium">Open in Zoom</a>
            </p>
          </div>
        </section>

        <section className="rounded-2xl bg-black/30 backdrop-blur-md border border-white/10 shadow-2xl shadow-black/20 px-6 py-8">
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
              In Zoom: virtual backgrounds change automatically
            </li>
          </ul>
        </section>
      </main>
    </div>
  )
}

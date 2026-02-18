export default function OAuthRedirect() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-black/25 backdrop-blur-md border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <img
            src="/landing/Toastmasters-Timer-logo.jpg"
            alt="Toastmaster Timer"
            className="h-10 w-10 rounded-xl object-cover shadow-sm ring-1 ring-white/20"
          />
          <h1 className="text-xl font-semibold text-white">Toastmaster Timer</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="rounded-2xl bg-black/30 backdrop-blur-md border border-white/10 shadow-2xl px-8 py-12">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white">
            Zoom app installed successfully
          </h2>
          <p className="mt-4 text-lg text-gray-300">
            Open Zoom and start or join a meeting to use Toastmaster Timer. The app will appear in your meeting toolbar.
          </p>
          <p className="mt-6 text-gray-400">
            You can close this tab and return to Zoom.
          </p>
        </div>
      </main>
    </div>
  )
}

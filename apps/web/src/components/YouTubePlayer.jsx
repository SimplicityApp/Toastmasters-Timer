import { useEffect, useRef } from 'react'
import { trackEvent } from '../utils/posthog'

// Load the YT IFrame API script once globally
let apiReady = typeof window !== 'undefined' && window.YT?.Player
  ? Promise.resolve()
  : null

function loadApi() {
  if (apiReady) return apiReady
  apiReady = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve() }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  })
  return apiReady
}

export default function YouTubePlayer({ videoId, title, page }) {
  const containerRef = useRef(null)
  const hasFiredRef = useRef(false)

  useEffect(() => {
    let player
    loadApi().then(() => {
      if (!containerRef.current) return
      player = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: { rel: 0 },
        events: {
          onStateChange: ({ data }) => {
            if (data === window.YT.PlayerState.PLAYING && !hasFiredRef.current) {
              hasFiredRef.current = true
              trackEvent('full_demo_played', { page })
            }
          }
        }
      })
    })
    return () => { player?.destroy() }
  }, [videoId, page])

  return (
    <div
      ref={containerRef}
      className="w-full"
      style={{ aspectRatio: '16/9' }}
      title={title}
    />
  )
}

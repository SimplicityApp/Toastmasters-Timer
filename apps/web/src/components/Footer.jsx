import { ExternalLink } from 'lucide-react';

const ZOOM_MARKETPLACE_URL = 'https://marketplace.zoom.us/apps/sWHvcm4YShyr6SXQQI8DFw';

export default function Footer() {
  return (
    <footer className="w-full border-t border-gray-200 bg-white px-4 py-2 flex items-center justify-center">
      <a
        href={ZOOM_MARKETPLACE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
      >
        <ExternalLink className="w-4 h-4" />
        Add to Zoom
      </a>
    </footer>
  );
}

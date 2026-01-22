# Toastmaster Timer

A Zoom app that automates the Timer role in Toastmasters meetings by controlling virtual backgrounds and tracking speech times.

## Overview

Toastmaster Timer is a Zoom Apps application designed to streamline the Timer role during Toastmasters meetings. It automatically changes your Zoom virtual background based on speech timing (green → yellow → red) and provides comprehensive tracking and reporting features.

## Features

- **Automatic Virtual Background Control**: Changes Zoom virtual backgrounds based on speech timing
  - 🟢 Green: Within time limit
  - 🟡 Yellow: Warning period
  - 🔴 Red: Over time limit

- **Multiple Speech Types**: Pre-configured timing rules for:
  - Standard Speech (5-6-7 minutes)
  - Ice Breaker (4-5-6 minutes)
  - Table Topics (1-1.5-2 minutes)
  - Evaluation (2-2.5-3 minutes)
  - Toast (1-1.5-2 minutes)
  - Custom timing rules

- **Three Main Tabs**:
  - **Live**: Real-time timer with speaker management
  - **Agenda**: Plan and organize meeting agenda
  - **Report**: View detailed timing reports

- **Speaker Management**: Add, track, and manage multiple speakers
- **Persistent Storage**: Saves agenda and settings locally
- **Customizable Rules**: Edit timing rules for different speech types

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Zoom Apps SDK** - Zoom integration
- **@dnd-kit** - Drag and drop functionality
- **@headlessui/react** - Accessible UI components
- **lucide-react** - Icons

## Prerequisites

- Node.js 16+ and npm
- Zoom account with Developer Mode enabled
- Zoom App created in Zoom Marketplace

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd ToastMasterTimer
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure the app**:
   - Update `public/manifest.json` with your Zoom App ID
   - Add background images to `public/backgrounds/`:
     - `green.png` (recommended: 1920x1080)
     - `yellow.png` (recommended: 1920x1080)
     - `red.png` (recommended: 1920x1080)

## Development

1. **Start the development server**:
   ```bash
   npm run dev
   ```

   The app will open at `http://localhost:3000`

2. **Test in Zoom**:
   - Enable Zoom Developer Mode
   - Load the app using your local development URL (use ngrok or similar for HTTPS)
   - Or deploy to Vercel for testing (see [DEPLOYMENT.md](./DEPLOYMENT.md))

## Building

Build for production:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions to Vercel.

Quick deployment:

```bash
npm i -g vercel
vercel
```

### Production Configuration

To disable the debug panel in production, set the environment variable:

```bash
VITE_ENABLE_DEBUG_PANEL=false
```

Or add it to your `.env` file:
```
VITE_ENABLE_DEBUG_PANEL=false
```

The debug panel is enabled by default for development and can be toggled by users. In production, you can completely hide it by setting the environment variable to `false`.

## Project Structure

```
ToastMasterTimer/
├── public/
│   ├── backgrounds/      # Virtual background images
│   └── manifest.json     # Zoom app manifest
├── src/
│   ├── components/       # React components
│   │   ├── AgendaTab.jsx
│   │   ├── EditRulesModal.jsx
│   │   ├── LiveTab.jsx
│   │   ├── NavTabs.jsx
│   │   ├── ReportTab.jsx
│   │   ├── SpeakerInput.jsx
│   │   └── TimerDisplay.jsx
│   ├── constants/
│   │   └── timingRules.js  # Default timing rules
│   ├── context/
│   │   └── TimerContext.jsx # Global state management
│   ├── utils/
│   │   ├── storage.js      # Local storage utilities
│   │   ├── timerLogic.js   # Timer calculations
│   │   └── zoomSdk.js      # Zoom SDK integration
│   ├── App.jsx
│   └── main.jsx
├── vercel.json           # Vercel configuration
└── vite.config.js        # Vite configuration
```

## Usage

1. **Start a Meeting**: Open the app in a Zoom meeting
2. **Select Speech Type**: Choose the appropriate speech type for timing rules
3. **Add Speakers**: Add speakers to track
4. **Start Timer**: Begin timing when a speaker starts
5. **Automatic Backgrounds**: The app automatically changes your virtual background based on elapsed time
6. **View Reports**: Check the Report tab for detailed timing information

## Configuration

### Timing Rules

Default timing rules are defined in `src/constants/timingRules.js`. You can customize these rules through the Edit Rules modal in the app.

### Background Images

Place your background images in `public/backgrounds/`:
- `green.png` - Displayed during green time period
- `yellow.png` - Displayed during yellow warning period
- `red.png` - Displayed when over time limit

Recommended size: 1920x1080 pixels

## License

[Add your license here]

## Support

For issues and questions, please [open an issue](<repository-url>/issues) or contact the developer.

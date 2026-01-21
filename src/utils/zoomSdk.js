import zoomSdk from '@zoom/appssdk';

// Production base URL for background images
const PRODUCTION_BASE_URL = 'https://www.timer.simple-tech.app';

// Get the base URL for static assets (works in both dev and production)
function getBackgroundUrl(color) {
  // In browser, use the current origin (works automatically in production)
  if (typeof window !== 'undefined') {
    const baseUrl = window.location.origin;
    return `${baseUrl}/backgrounds/${color}.png`;
  }
  // Fallback to production URL if window is not available
  return `${PRODUCTION_BASE_URL}/backgrounds/${color}.png`;
}

// Virtual background image URLs getter
// Images are hosted at: https://www.timer.simple-tech.app/backgrounds/{color}.png
function getBackgroundUrls() {
  return {
    green: getBackgroundUrl('green'),
    yellow: getBackgroundUrl('yellow'),
    red: getBackgroundUrl('red'),
    white: null, // No background change for white
  };
}

// Track SDK initialization state
let sdkInitialized = false;
let sdkAvailable = false;

/**
 * Set virtual background using Zoom SDK
 * @param {'white' | 'green' | 'yellow' | 'red'} color - Background color to set
 */
export async function setVirtualBackground(color) {
  // Skip if white (no background change)
  if (color === 'white') {
    return;
  }

  const urls = getBackgroundUrls();
  const fileUrl = urls[color];
  if (!fileUrl) {
    console.warn(`No background URL for color: ${color}`);
    return;
  }

  try {
    if (sdkAvailable) {
      // Real Zoom SDK integration
      await zoomSdk.setVirtualBackground({ fileUrl });
      console.log(`Zoom SDK: Set virtual background to ${color}`);
    } else {
      // Mock implementation for local development
      console.log(`[MOCK] Zoom SDK: Would set virtual background to ${color} (${fileUrl})`);
    }
  } catch (error) {
    console.error('Failed to set virtual background:', error);
    // Don't throw - allow app to continue functioning
  }
}

/**
 * Initialize Zoom SDK
 */
export async function initializeZoomSdk() {
  if (sdkInitialized) {
    return sdkAvailable;
  }

  sdkInitialized = true;

  try {
    // Check if we're in a Zoom environment
    // The SDK will be available when running in Zoom client
    await zoomSdk.config({
      popoutSize: { width: 400, height: 600 },
      capabilities: [
        'shareApp',
        'virtualBackground'
      ],
      version: '1.0.0'
    });

    sdkAvailable = true;
    console.log('Zoom SDK initialized successfully');
    return true;
  } catch (error) {
    // SDK not available (running locally or not in Zoom environment)
    sdkAvailable = false;
    console.log('[MOCK] Zoom SDK: Running in mock mode (not in Zoom environment)');
    console.log('SDK initialization error (expected in local dev):', error.message);
    return false;
  }
}

/**
 * Get list of Zoom participants
 * @returns {Array} Array of participant objects
 */
export async function getZoomParticipants() {
  try {
    if (sdkAvailable) {
      // Try to get participants from Zoom SDK
      // Note: This API may require specific scopes/permissions
      try {
        const participants = await zoomSdk.getParticipants();
        if (participants && Array.isArray(participants)) {
          return participants.map((p, index) => ({
            id: p.userId || p.id || `user-${index}`,
            name: p.displayName || p.userName || p.name || 'Unknown'
          }));
        }
      } catch (sdkError) {
        // Participants API might not be available or require additional permissions
        console.log('Participants API not available:', sdkError.message);
      }
      return [];
    } else {
      // Mock participants for local development
      return [
        { id: '1', name: 'John Doe' },
        { id: '2', name: 'Sarah Smith' },
        { id: '3', name: 'Alex Johnson' },
        { id: '4', name: 'Mike Chen' },
      ];
    }
  } catch (error) {
    console.error('Failed to get Zoom participants:', error);
    // Return mock data as fallback
    return [
      { id: '1', name: 'John Doe' },
      { id: '2', name: 'Sarah Smith' },
      { id: '3', name: 'Alex Johnson' },
      { id: '4', name: 'Mike Chen' },
    ];
  }
}

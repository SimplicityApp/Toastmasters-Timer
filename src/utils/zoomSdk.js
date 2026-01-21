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
    // Try to clear virtual background when going back to white
    if (sdkAvailable && zoomSdk && typeof zoomSdk.setVirtualBackground === 'function') {
      try {
        await zoomSdk.setVirtualBackground({ fileUrl: null });
        console.log('Zoom SDK: Cleared virtual background');
      } catch (error) {
        console.warn('Failed to clear virtual background:', error.message);
      }
    }
    return;
  }

  const urls = getBackgroundUrls();
  const fileUrl = urls[color];
  if (!fileUrl) {
    console.warn(`No background URL for color: ${color}`);
    return;
  }

  // Ensure SDK is initialized before attempting to set background
  if (!sdkInitialized) {
    console.warn('SDK not initialized yet, initializing now...');
    await initializeZoomSdk();
  }

  try {
    if (sdkAvailable && zoomSdk && typeof zoomSdk.setVirtualBackground === 'function') {
      // Real Zoom SDK integration
      console.log(`Zoom SDK: Attempting to set virtual background to ${color}`);
      console.log(`File URL: ${fileUrl}`);
      
      const result = await zoomSdk.setVirtualBackground({ fileUrl });
      console.log(`Zoom SDK: Successfully set virtual background to ${color}`, result);
      
      // Verify the background was set (some SDKs return a status)
      if (result && result.status) {
        console.log(`Background set status: ${result.status}`);
      }
    } else {
      // SDK not available
      console.warn(`[MOCK] Zoom SDK: Would set virtual background to ${color} (${fileUrl})`);
      if (!sdkAvailable) {
        console.warn(`[MOCK] SDK is not available. Make sure you're running this app inside Zoom client.`);
      }
      if (!zoomSdk || typeof zoomSdk.setVirtualBackground !== 'function') {
        console.warn(`[MOCK] setVirtualBackground function is not available on zoomSdk object`);
      }
    }
  } catch (error) {
    console.error('Failed to set virtual background:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    });
    
    // Provide helpful error message
    if (error.message && error.message.includes('permission')) {
      console.error('⚠️ Permission error: Make sure virtual backgrounds are enabled in your Zoom settings');
    } else if (error.message && error.message.includes('video')) {
      console.error('⚠️ Video error: Make sure your video is turned on in the Zoom meeting');
    } else if (error.code) {
      console.error(`⚠️ Error code: ${error.code}. Check Zoom SDK documentation for this error code.`);
    }
    
    // Don't throw - allow app to continue functioning
  }
}

/**
 * Initialize Zoom SDK
 */
export async function initializeZoomSdk() {
  if (sdkInitialized) {
    console.log(`Zoom SDK already initialized. Available: ${sdkAvailable}`);
    return sdkAvailable;
  }

  sdkInitialized = true;

  try {
    // Check if we're in a Zoom environment
    // The SDK will be available when running in Zoom client
    console.log('Initializing Zoom SDK...');
    const configResult = await zoomSdk.config({
      popoutSize: { width: 400, height: 600 },
      capabilities: [
        'shareApp',
        'virtualBackground'
      ],
      version: '1.0.0'
    });

    sdkAvailable = true;
    console.log('Zoom SDK initialized successfully', configResult);
    console.log('Virtual background capability is available');
    return true;
  } catch (error) {
    // SDK not available (running locally or not in Zoom environment)
    sdkAvailable = false;
    console.warn('[MOCK] Zoom SDK: Running in mock mode (not in Zoom environment)');
    console.warn('SDK initialization error:', {
      message: error.message,
      code: error.code,
      name: error.name
    });
    console.warn('Note: Virtual backgrounds will only work when running inside Zoom client');
    return false;
  }
}

/**
 * Check if SDK is available (for debugging)
 */
export function isSdkAvailable() {
  return sdkAvailable;
}

/**
 * Get SDK status for debugging
 */
export function getSdkStatus() {
  return {
    initialized: sdkInitialized,
    available: sdkAvailable,
    sdkExists: typeof zoomSdk !== 'undefined',
    hasSetVirtualBackground: zoomSdk && typeof zoomSdk.setVirtualBackground === 'function'
  };
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

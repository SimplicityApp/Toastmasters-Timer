import zoomSdk from '@zoom/appssdk';

// Production base URL for background images
const PRODUCTION_BASE_URL = 'https://www.timer.simple-tech.app';

// Get the base URL for static assets (works in both dev and production)
export function getBackgroundUrl(color) {
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
 * Apply video filter overlay using Zoom SDK
 * @param {string} imageUrl - URL of the image to use as overlay
 */
export async function applyOverlay(imageUrl) {
  // Ensure SDK is initialized before attempting to set filter
  if (!sdkInitialized) {
    console.warn('SDK not initialized yet, initializing now...');
    await initializeZoomSdk();
  }

  try {
    if (sdkAvailable && zoomSdk && typeof zoomSdk.setVideoFilter === 'function') {
      console.log(`Zoom SDK: Attempting to apply video filter overlay`);
      console.log(`File URL: ${imageUrl}`);
      
      const result = await zoomSdk.setVideoFilter({ fileUrl: imageUrl });
      console.log(`Zoom SDK: Successfully applied video filter overlay`, result);
      
      // Verify the filter was set (some SDKs return a status)
      if (result && result.status) {
        console.log(`Filter set status: ${result.status}`);
      }
    } else {
      // SDK not available
      console.warn(`[MOCK] Zoom SDK: Would apply video filter overlay (${imageUrl})`);
      if (!sdkAvailable) {
        console.warn(`[MOCK] SDK is not available. Make sure you're running this app inside Zoom client.`);
      }
      if (!zoomSdk || typeof zoomSdk.setVideoFilter !== 'function') {
        console.warn(`[MOCK] setVideoFilter function is not available on zoomSdk object`);
      }
    }
  } catch (error) {
    console.error('Failed to apply video filter overlay:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    });
    
    // Provide helpful error message
    if (error.message && error.message.includes('permission')) {
      console.error('⚠️ Permission error: Make sure video filters are enabled in your Zoom settings');
    } else if (error.message && error.message.includes('video')) {
      console.error('⚠️ Video error: Make sure your video is turned on in the Zoom meeting');
    } else if (error.code) {
      console.error(`⚠️ Error code: ${error.code}. Check Zoom SDK documentation for this error code.`);
    }
    
    // Don't throw - allow app to continue functioning
  }
}

/**
 * Remove video filter overlay
 */
export async function removeVideoFilter() {
  // Ensure SDK is initialized
  if (!sdkInitialized) {
    console.warn('SDK not initialized yet, initializing now...');
    await initializeZoomSdk();
  }

  try {
    if (sdkAvailable && zoomSdk) {
      // Try removeVideoFilter first, fallback to setVideoFilter with null
      if (typeof zoomSdk.removeVideoFilter === 'function') {
        console.log('Zoom SDK: Attempting to remove video filter');
        await zoomSdk.removeVideoFilter();
        console.log('Zoom SDK: Successfully removed video filter');
      } else if (typeof zoomSdk.setVideoFilter === 'function') {
        console.log('Zoom SDK: Attempting to remove video filter via setVideoFilter(null)');
        await zoomSdk.setVideoFilter({ fileUrl: null });
        console.log('Zoom SDK: Successfully removed video filter');
      } else {
        console.warn('[MOCK] Zoom SDK: Would remove video filter');
      }
    } else {
      console.warn('[MOCK] Zoom SDK: Would remove video filter (SDK not available)');
    }
  } catch (error) {
    console.error('Failed to remove video filter:', error);
    // Don't throw - allow app to continue functioning
  }
}

/**
 * Get current video state (on/off)
 * @returns {Promise<boolean>} True if video is on, false if off
 */
export async function getVideoState() {
  try {
    if (sdkAvailable && zoomSdk && typeof zoomSdk.getUserContext === 'function') {
      const context = await zoomSdk.getUserContext();
      const videoState = context?.videoState ?? false;
      console.log('Zoom SDK: Video state:', videoState);
      return videoState;
    } else {
      console.warn('[MOCK] Zoom SDK: Would get video state (SDK not available)');
      // Return true in mock mode to allow development
      return true;
    }
  } catch (error) {
    console.error('Failed to get video state:', error);
    // Return false on error to be safe
    return false;
  }
}

/**
 * Set video state (turn video on/off)
 * @param {boolean} enabled - True to turn video on, false to turn off
 */
export async function setVideoState(enabled) {
  // Ensure SDK is initialized
  if (!sdkInitialized) {
    console.warn('SDK not initialized yet, initializing now...');
    await initializeZoomSdk();
  }

  try {
    if (sdkAvailable && zoomSdk && typeof zoomSdk.setVideoState === 'function') {
      console.log(`Zoom SDK: Attempting to set video state to ${enabled ? 'ON' : 'OFF'}`);
      const result = await zoomSdk.setVideoState(enabled);
      console.log(`Zoom SDK: Successfully set video state to ${enabled ? 'ON' : 'OFF'}`, result);
      return result;
    } else {
      console.warn(`[MOCK] Zoom SDK: Would set video state to ${enabled ? 'ON' : 'OFF'} (SDK not available)`);
      if (!sdkAvailable) {
        console.warn(`[MOCK] SDK is not available. Make sure you're running this app inside Zoom client.`);
      }
      if (!zoomSdk || typeof zoomSdk.setVideoState !== 'function') {
        console.warn(`[MOCK] setVideoState function is not available on zoomSdk object`);
      }
      return null;
    }
  } catch (error) {
    console.error('Failed to set video state:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      name: error.name
    });
    
    // Provide helpful error message
    if (error.message && error.message.includes('permission')) {
      console.error('⚠️ Permission error: Video state control may require user permission');
    }
    
    throw error; // Re-throw so caller can handle it
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

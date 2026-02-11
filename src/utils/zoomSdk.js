import zoomSdk from '@zoom/appssdk';

// Production base URL for background images
const PRODUCTION_BASE_URL = 'https://www.timer.simple-tech.app';

// Bump this version when background images are updated to bust CDN/browser cache
const BACKGROUND_VERSION = '2';

// Zoom overlay image filenames (Toastmasters-branded backgrounds)
const ZOOM_OVERLAY_FILES = {
  blue: 'timer-blue-background.png',
  green: 'timer-green-background.png',
  yellow: 'timer-yellow-background.png',
  red: 'timer-red-background.png',
};

// Get the base URL for static assets (works in both dev and production)
export function getBackgroundUrl(color) {
  const imageFile = ZOOM_OVERLAY_FILES[color] || ZOOM_OVERLAY_FILES.blue;

  // In browser, use the current origin (works automatically in production)
  if (typeof window !== 'undefined') {
    const baseUrl = window.location.origin;
    return `${baseUrl}/backgrounds/${imageFile}?v=${BACKGROUND_VERSION}`;
  }
  // Fallback to production URL if window is not available
  return `${PRODUCTION_BASE_URL}/backgrounds/${imageFile}?v=${BACKGROUND_VERSION}`;
}

// Overlay mode constants
export const OVERLAY_MODE_CARD = 'card';
export const OVERLAY_MODE_CAMERA = 'camera';
let currentOverlayMode = OVERLAY_MODE_CARD;

// Track SDK initialization state
let sdkInitialized = false;
let sdkAvailable = false;

// Track last error for debugging
let lastError = null;

// Log callback function - will be set by LiveTab component
let logCallback = null;

// Cache for pre-loaded ImageData objects
const imageDataCache = new Map();

/**
 * Set log callback for debug panel
 * @param {Function} callback - Function to call with log messages
 */
export function setLogCallback(callback) {
  logCallback = callback;
}

/**
 * Internal logging function
 */
function log(message, type = 'info') {
  if (logCallback) {
    logCallback(message, type);
  }
  // Also log to console
  if (type === 'error') {
    console.error(message);
  } else if (type === 'warn') {
    console.warn(message);
  } else {
    console.log(message);
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
    log('Initializing Zoom SDK...', 'info');
    const configResult = await zoomSdk.config({
      popoutSize: { width: 400, height: 600 },
      capabilities: [
        'shareApp',
        'videoFilter',
        'virtualBackground'
      ],
      version: '1.0.0'
    });

    sdkAvailable = true;
    log(`Zoom SDK initialized successfully. Config: ${JSON.stringify(configResult)}`, 'info');
    log('Video filter capability is available', 'info');
    return true;
  } catch (error) {
    // SDK not available (running locally or not in Zoom environment)
    sdkAvailable = false;
    log('[MOCK] Zoom SDK: Running in mock mode (not in Zoom environment)', 'warn');
    log(`SDK initialization error: ${error.message || error.name} (Code: ${error.code || 'N/A'})`, 'warn');
    log('Note: Virtual backgrounds will only work when running inside Zoom client', 'warn');
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
  const status = {
    initialized: sdkInitialized,
    available: sdkAvailable,
    sdkExists: typeof zoomSdk !== 'undefined',
    hasSetVideoFilter: zoomSdk && typeof zoomSdk.setVideoFilter === 'function',
    hasDeleteVideoFilter: zoomSdk && typeof zoomSdk.deleteVideoFilter === 'function',
    hasGetUserContext: zoomSdk && typeof zoomSdk.getUserContext === 'function',
    hasGetVideoState: zoomSdk && typeof zoomSdk.getVideoState === 'function',
    hasSetVideoState: zoomSdk && typeof zoomSdk.setVideoState === 'function',
    hasSetVirtualBackground: zoomSdk && typeof zoomSdk.setVirtualBackground === 'function',
    hasRemoveVirtualBackground: zoomSdk && typeof zoomSdk.removeVirtualBackground === 'function',
    overlayMode: currentOverlayMode,
  };
  
  // Get available methods for debugging
  if (zoomSdk && typeof zoomSdk === 'object') {
    status.availableMethods = Object.keys(zoomSdk).filter(key => typeof zoomSdk[key] === 'function');
  }
  
  return status;
}

/**
 * Load image from URL and convert to ImageData (using direct Image() load, works better in Zoom client)
 * @param {string} imageUrl - URL of the image
 * @returns {Promise<ImageData>} ImageData object
 */
async function loadImageAsImageData(imageUrl) {
  // Check cache first
  if (imageDataCache.has(imageUrl)) {
    log(`Using cached ImageData for: ${imageUrl}`, 'info');
    return imageDataCache.get(imageUrl);
  }
  
  log(`Loading image: ${imageUrl}`, 'info');
  
  // In Zoom client, direct Image() load works better than fetch
  // Use direct Image() load (similar to how UI images work)
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let resolved = false;
    
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`Image load timeout after 10 seconds: ${imageUrl}`));
      }
    }, 10000);
    
    img.onload = () => {
      if (resolved) return;
      clearTimeout(timeout);
      
      // Verify image actually loaded
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        resolved = true;
        reject(new Error(`Image loaded but has invalid dimensions: ${img.naturalWidth}x${img.naturalHeight}`));
        return;
      }
      
      try {
        // Create a canvas to convert image to ImageData
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.scale(-1, 1);
        ctx.drawImage(img, -img.naturalWidth, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Cache the ImageData for future use
        imageDataCache.set(imageUrl, imageData);
        
        log(`Loaded image: ${img.naturalWidth}x${img.naturalHeight}, ImageData size: ${imageData.data.length} bytes (cached)`, 'info');
        resolved = true;
        resolve(imageData);
      } catch (error) {
        log(`Error converting image to ImageData: ${error.message}`, 'error');
        resolved = true;
        reject(error);
      }
    };
    
    img.onerror = (event) => {
      if (resolved) return;
      clearTimeout(timeout);
      const errorMsg = `Image load failed: ${event.message || event.type || 'Unknown error'}`;
      log(`Image onerror event: ${errorMsg}`, 'error');
      log(`Image naturalWidth: ${img.naturalWidth}, naturalHeight: ${img.naturalHeight}`, 'error');
      log(`Image complete: ${img.complete}, width: ${img.width}, height: ${img.height}`, 'error');
      resolved = true;
      reject(new Error(`Failed to load image from ${imageUrl}: ${errorMsg}`));
    };
    
    // Set src to load image (works like UI images in Zoom client)
    img.src = imageUrl;
  });
}

/**
 * Pre-load all background images and cache them as ImageData
 * This should be called when the app initializes
 */
export async function preloadBackgroundImages() {
  // Map status colors to Zoom overlay image URLs (timer-*-background.*)
  const colors = ['blue', 'green', 'yellow', 'red'];
  log('Pre-loading background images...', 'info');
  
  const loadPromises = colors.map(async (color) => {
    const url = getBackgroundUrl(color);
    try {
      await loadImageAsImageData(url);
      log(`Pre-loaded ${color} status`, 'info');
    } catch (error) {
      log(`Failed to pre-load ${color} status: ${error.message}`, 'warn');
    }
  });
  
  await Promise.allSettled(loadPromises);
  log(`Pre-loading complete. Cached ${imageDataCache.size} images.`, 'info');
}

/**
 * Get current overlay mode
 * @returns {string} Current overlay mode ('card' or 'camera')
 */
export function getOverlayMode() {
  return currentOverlayMode;
}

/**
 * Set overlay mode and reapply overlay if needed
 * @param {string} mode - New overlay mode ('card' or 'camera')
 * @param {string|null} currentImageUrl - Current image URL to reapply, or null to skip reapply
 */
export async function setOverlayMode(mode, currentImageUrl) {
  if (mode === currentOverlayMode) return;
  // Remove overlay using the old mode
  await removeOverlayInternal(currentOverlayMode);
  currentOverlayMode = mode;
  // Reapply with new mode if an image URL is provided
  if (currentImageUrl) {
    await applyOverlay(currentImageUrl);
  }
}

/**
 * Internal helper to remove overlay by mode type
 * @param {string} mode - Overlay mode to remove ('card' or 'camera')
 */
async function removeOverlayInternal(mode) {
  if (!sdkInitialized) {
    log('SDK not initialized yet, initializing now...', 'warn');
    await initializeZoomSdk();
  }

  try {
    if (sdkAvailable && zoomSdk) {
      if (mode === OVERLAY_MODE_CAMERA) {
        if (typeof zoomSdk.removeVirtualBackground === 'function') {
          log('Removing virtual background', 'info');
          await zoomSdk.removeVirtualBackground();
          log('Successfully removed virtual background', 'info');
        } else {
          log('[MOCK] Would remove virtual background', 'warn');
        }
      } else {
        if (typeof zoomSdk.deleteVideoFilter === 'function') {
          log('Deleting video filter', 'info');
          await zoomSdk.deleteVideoFilter();
          log('Successfully deleted video filter', 'info');
        } else if (typeof zoomSdk.setVideoFilter === 'function') {
          log('Removing video filter via setVideoFilter(null)', 'info');
          await zoomSdk.setVideoFilter({ fileUrl: null });
          log('Successfully removed video filter', 'info');
        } else {
          log('[MOCK] Would remove video filter', 'warn');
        }
      }
    } else {
      log(`[MOCK] Would remove overlay (mode: ${mode}, SDK not available)`, 'warn');
    }
  } catch (error) {
    log(`Failed to remove overlay (mode: ${mode}): ${error.message || error.name}`, 'error');
    if (error.code) {
      log(`Error code: ${error.code}`, 'error');
      if (error.code === 10195) {
        log('No overlay exists to remove', 'warn');
      }
    }
  }
}

/**
 * Apply video filter overlay using Zoom SDK
 * @param {string} imageUrl - URL of the image to use as overlay
 */
export async function applyOverlay(imageUrl) {
  // Ensure SDK is initialized before attempting to set filter
  if (!sdkInitialized) {
    log('SDK not initialized yet, initializing now...', 'warn');
    await initializeZoomSdk();
  }

  if (!imageUrl) {
    log('No image URL provided for overlay', 'warn');
    return;
  }

  try {
    if (sdkAvailable && zoomSdk) {
      // Load image and convert to ImageData (shared for both modes)
      log(`Loading image for overlay (mode: ${currentOverlayMode}): ${imageUrl}`, 'info');
      const imageData = await loadImageAsImageData(imageUrl);
      log(`Loaded ImageData: ${imageData.width}x${imageData.height}`, 'info');

      if (currentOverlayMode === OVERLAY_MODE_CAMERA) {
        // Camera mode: use setVirtualBackground so user's face shows on top
        if (typeof zoomSdk.setVirtualBackground === 'function') {
          const result = await zoomSdk.setVirtualBackground({ imageData });
          log(`Successfully applied virtual background. Result: ${JSON.stringify(result)}`, 'info');
          lastError = null;
          return;
        }
      } else {
        // Card mode: use setVideoFilter (covers entire video)
        if (typeof zoomSdk.setVideoFilter === 'function') {
          const result = await zoomSdk.setVideoFilter({ imageData });
          log(`Successfully applied video filter overlay. Result: ${JSON.stringify(result)}`, 'info');
          lastError = null;
          if (result && result.status) {
            log(`Filter set status: ${result.status}`, 'info');
          }
          return;
        }
      }
    }

    // SDK not available or function not found
    log(`[MOCK] Would apply overlay (mode: ${currentOverlayMode}, ${imageUrl})`, 'warn');
    if (!sdkAvailable) {
      log(`[MOCK] SDK is not available. Make sure you're running this app inside Zoom client.`, 'warn');
    }
    if (!zoomSdk) {
      log(`[MOCK] zoomSdk object is not available`, 'warn');
    } else {
      const availableMethods = Object.keys(zoomSdk).filter(key => typeof zoomSdk[key] === 'function');
      log(`[MOCK] Required overlay function not available. Available methods: ${availableMethods.join(', ')}`, 'warn');
    }
  } catch (error) {
    log(`Failed to apply video filter overlay: ${error.message || error.name}`, 'error');
    log(`Error details: ${JSON.stringify({ message: error.message, code: error.code, name: error.name })}`, 'error');
    
    // Store error for debug panel
    let errorMessage = `Failed to apply overlay: ${error.message || error.name || 'Unknown error'}`;
    if (error.code) {
      errorMessage += ` (Code: ${error.code})`;
    }
    
    // Provide helpful error message
    if (error.message && error.message.includes('permission')) {
      errorMessage = 'Permission error: Make sure video filters are enabled in your Zoom settings';
      log('⚠️ ' + errorMessage, 'error');
    } else if (error.message && error.message.includes('video')) {
      errorMessage = 'Video error: Make sure your video is turned on in the Zoom meeting';
      log('⚠️ ' + errorMessage, 'error');
    } else if (error.code) {
      errorMessage = `Error code: ${error.code}. Check Zoom SDK documentation for this error code.`;
      log(`⚠️ ${errorMessage}`, 'error');
    }
    
    lastError = errorMessage;
    
    // Don't throw - allow app to continue functioning
  }
}

/**
 * Remove current overlay (dispatches to correct removal based on current mode)
 */
export async function removeOverlay() {
  await removeOverlayInternal(currentOverlayMode);
}

/**
 * Get current video state (on/off)
 * @returns {Promise<boolean | null>} True if video is on, false if off, null if unable to determine
 */
export async function getVideoState() {
  // Ensure SDK is initialized first
  if (!sdkInitialized) {
    console.warn('SDK not initialized yet, initializing now...');
    await initializeZoomSdk();
  }

  try {
    if (sdkAvailable && zoomSdk && typeof zoomSdk.getVideoState === 'function') {
      const result = await zoomSdk.getVideoState();
      
      // According to Zoom SDK: GetVideoStateResponse = { video: boolean }
      // video: false means off, true means on
      const videoState = result?.video;
      
      // Only return false if explicitly false, otherwise return null if undefined
      if (videoState === false) {
        console.log('Zoom SDK: Video state: OFF');
        log('Zoom SDK: Video state: OFF', 'info');
        return false;
      } else if (videoState === true) {
        console.log('Zoom SDK: Video state: ON');
        log('Zoom SDK: Video state: ON', 'info');
        return true;
      } else {
        console.warn('Zoom SDK: Video state is undefined, cannot determine. Result:', result);
        log(`Zoom SDK: Video state is undefined, cannot determine. Result: ${JSON.stringify(result)}`, 'warn');
        return null; // Return null if we can't determine
      }
    } else {
      console.warn('[MOCK] Zoom SDK: Would get video state (SDK not available)');
      log('[MOCK] Zoom SDK: Would get video state (SDK not available)', 'warn');
      // Return null in mock mode to indicate we can't determine (don't show warning)
      return null;
    }
  } catch (error) {
    console.error('Failed to get video state:', error);
    log(`Failed to get video state: ${error.message || error.name}`, 'error');
    // Return null on error to indicate we can't determine (don't show warning)
    return null;
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
      // According to Zoom SDK: SetVideoStateOptions = { video: boolean }
      console.log(`Zoom SDK: Attempting to set video state to ${enabled ? 'ON' : 'OFF'}`);
      log(`Zoom SDK: Attempting to set video state to ${enabled ? 'ON' : 'OFF'}`, 'info');
      const result = await zoomSdk.setVideoState({ video: enabled });
      console.log(`Zoom SDK: Successfully set video state to ${enabled ? 'ON' : 'OFF'}`, result);
      log(`Zoom SDK: Successfully set video state to ${enabled ? 'ON' : 'OFF'}`, 'info');
      return result;
    } else {
      console.warn(`[MOCK] Zoom SDK: Would set video state to ${enabled ? 'ON' : 'OFF'} (SDK not available)`);
      log(`[MOCK] Zoom SDK: Would set video state to ${enabled ? 'ON' : 'OFF'} (SDK not available)`, 'warn');
      if (!sdkAvailable) {
        console.warn(`[MOCK] SDK is not available. Make sure you're running this app inside Zoom client.`);
        log(`[MOCK] SDK is not available. Make sure you're running this app inside Zoom client.`, 'warn');
      }
      if (!zoomSdk || typeof zoomSdk.setVideoState !== 'function') {
        console.warn(`[MOCK] setVideoState function is not available on zoomSdk object`);
        log(`[MOCK] setVideoState function is not available on zoomSdk object`, 'warn');
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
      console.error('Failed to get Zoom sdk:', error);
      return [];
    }
  } catch (error) {
    console.error('Failed to get Zoom participants:', error);
    // Return mock data as fallback
    return [];
  }
}

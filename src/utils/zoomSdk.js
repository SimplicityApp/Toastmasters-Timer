import zoomSdk from '@zoom/appssdk';

// Production base URL for background images
const PRODUCTION_BASE_URL = 'https://www.timer.simple-tech.app';

// Get the base URL for static assets (works in both dev and production)
export function getBackgroundUrl(color) {
  // Map 'white' status to 'grey' image file
  const imageFile = color === 'white' ? 'grey' : color;
  
  // In browser, use the current origin (works automatically in production)
  if (typeof window !== 'undefined') {
    const baseUrl = window.location.origin;
    return `${baseUrl}/backgrounds/${imageFile}.png`;
  }
  // Fallback to production URL if window is not available
  return `${PRODUCTION_BASE_URL}/backgrounds/${imageFile}.png`;
}

// Virtual background image URLs getter
// Images are hosted at: https://www.timer.simple-tech.app/backgrounds/{color}.png
function getBackgroundUrls() {
  return {
    green: getBackgroundUrl('green'),
    yellow: getBackgroundUrl('yellow'),
    red: getBackgroundUrl('red'),
    white: getBackgroundUrl('grey'), // Use grey.png for white status
  };
}

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
    log('Initializing Zoom SDK...', 'info');
    const configResult = await zoomSdk.config({
      popoutSize: { width: 400, height: 600 },
      capabilities: [
        'shareApp',
        'virtualBackground',
        'videoFilter' // Add video filter capability if available
      ],
      version: '1.0.0'
    });

    sdkAvailable = true;
    log(`Zoom SDK initialized successfully. Config: ${JSON.stringify(configResult)}`, 'info');
    log('Virtual background capability is available', 'info');
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
    hasRemoveVideoFilter: zoomSdk && typeof zoomSdk.removeVideoFilter === 'function',
    hasSetVirtualBackground: zoomSdk && typeof zoomSdk.setVirtualBackground === 'function',
    hasGetUserContext: zoomSdk && typeof zoomSdk.getUserContext === 'function',
    hasSetVideoState: zoomSdk && typeof zoomSdk.setVideoState === 'function',
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
        ctx.drawImage(img, 0, 0);
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
  // Map status colors to actual image files (white status uses grey.png)
  const colors = ['white', 'green', 'yellow', 'red'];
  log('Pre-loading background images...', 'info');
  
  const loadPromises = colors.map(async (color) => {
    const url = getBackgroundUrl(color); // getBackgroundUrl maps white -> grey automatically
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
      // Try setVideoFilter first (newer API)
      if (typeof zoomSdk.setVideoFilter === 'function') {
        log(`Loading image for video filter: ${imageUrl}`, 'info');
        
        // Load image and convert to ImageData
        const imageData = await loadImageAsImageData(imageUrl);
        
        log(`Applying video filter overlay with ImageData (${imageData.width}x${imageData.height})`, 'info');
        
        // setVideoFilter expects { imageData: ImageData } not { fileUrl: string }
        const result = await zoomSdk.setVideoFilter({ imageData });
        log(`Successfully applied video filter overlay. Result: ${JSON.stringify(result)}`, 'info');
        
        // Clear error on success
        lastError = null;
        
        // Verify the filter was set (some SDKs return a status)
        if (result && result.status) {
          log(`Filter set status: ${result.status}`, 'info');
        }
        return;
      }
      // Fallback to setVirtualBackground if setVideoFilter is not available
      else if (typeof zoomSdk.setVirtualBackground === 'function') {
        log(`setVideoFilter not available, using setVirtualBackground as fallback: ${imageUrl}`, 'warn');
        
        const result = await zoomSdk.setVirtualBackground({ fileUrl: imageUrl });
        log(`Successfully applied virtual background. Result: ${JSON.stringify(result)}`, 'info');
        
        // Clear error on success
        lastError = null;
        return;
      }
    }
    
    // SDK not available or function not found
    log(`[MOCK] Would apply video filter overlay (${imageUrl})`, 'warn');
    if (!sdkAvailable) {
      log(`[MOCK] SDK is not available. Make sure you're running this app inside Zoom client.`, 'warn');
    }
    if (!zoomSdk) {
      log(`[MOCK] zoomSdk object is not available`, 'warn');
    } else {
      const availableMethods = Object.keys(zoomSdk).filter(key => typeof zoomSdk[key] === 'function');
      log(`[MOCK] setVideoFilter and setVirtualBackground functions are not available. Available methods: ${availableMethods.join(', ')}`, 'warn');
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
        log('Attempting to remove video filter', 'info');
        await zoomSdk.removeVideoFilter();
        log('Successfully removed video filter', 'info');
      } else if (typeof zoomSdk.setVideoFilter === 'function') {
        log('Attempting to remove video filter via setVideoFilter(null)', 'info');
        await zoomSdk.setVideoFilter({ fileUrl: null });
        log('Successfully removed video filter', 'info');
      } else {
        log('[MOCK] Would remove video filter', 'warn');
      }
    } else {
      log('[MOCK] Would remove video filter (SDK not available)', 'warn');
    }
  } catch (error) {
    console.error('Failed to remove video filter:', error);
    // Don't throw - allow app to continue functioning
  }
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
    if (sdkAvailable && zoomSdk && typeof zoomSdk.getUserContext === 'function') {
      const context = await zoomSdk.getUserContext();
      const videoState = context?.videoState;
      
      // Only return false if explicitly false, otherwise return null if undefined
      if (videoState === false) {
        console.log('Zoom SDK: Video state: OFF');
        return false;
      } else if (videoState === true) {
        console.log('Zoom SDK: Video state: ON');
        return true;
      } else {
        console.warn('Zoom SDK: Video state is undefined, cannot determine');
        return null; // Return null if we can't determine
      }
    } else {
      console.warn('[MOCK] Zoom SDK: Would get video state (SDK not available)');
      // Return null in mock mode to indicate we can't determine (don't show warning)
      return null;
    }
  } catch (error) {
    console.error('Failed to get video state:', error);
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

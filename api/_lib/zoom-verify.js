import crypto from 'node:crypto';

/**
 * Verify the Zoom webhook signature (x-zm-signature header).
 * Uses HMAC-SHA256 with timing-safe comparison.
 *
 * @param {object} headers - Request headers (lowercase keys)
 * @param {string} rawBody - Raw request body string
 * @returns {boolean} Whether the signature is valid
 */
export function verifyZoomSignature(headers, rawBody) {
  const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
  if (!secret) return false;

  const timestamp = headers['x-zm-request-timestamp'];
  const signature = headers['x-zm-signature'];
  if (!timestamp || !signature) return false;

  const message = `v0:${timestamp}:${rawBody}`;
  const hashForVerify = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
  const expectedSignature = `v0=${hashForVerify}`;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Generate a CRC response for Zoom's endpoint URL validation.
 *
 * @param {string} plainToken - The plainToken from Zoom's validation request
 * @returns {{ plainToken: string, encryptedToken: string }}
 */
export function generateCrcResponse(plainToken) {
  const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
  const encryptedToken = crypto
    .createHmac('sha256', secret)
    .update(plainToken)
    .digest('hex');

  return { plainToken, encryptedToken };
}

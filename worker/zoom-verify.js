import crypto from 'node:crypto';

/**
 * Verify the Zoom webhook signature (x-zm-signature header).
 * Uses HMAC-SHA256 with timing-safe comparison.
 *
 * Ported from api/_lib/zoom-verify.js for the Cloudflare Worker runtime:
 *  - `headers` is a Web `Headers` object (use .get()), not a plain object.
 *  - the secret is passed in explicitly (from `env`) instead of process.env.
 *
 * @param {Headers} headers - Request headers
 * @param {string} rawBody - Raw request body string
 * @param {string|undefined} secret - ZOOM_WEBHOOK_SECRET_TOKEN
 * @returns {boolean} Whether the signature is valid
 */
export function verifyZoomSignature(headers, rawBody, secret) {
  if (!secret) return false;

  const timestamp = headers.get('x-zm-request-timestamp');
  const signature = headers.get('x-zm-signature');
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
 * @param {string|undefined} secret - ZOOM_WEBHOOK_SECRET_TOKEN
 * @returns {{ plainToken: string, encryptedToken: string }}
 */
export function generateCrcResponse(plainToken, secret) {
  if (!secret) {
    throw new Error('ZOOM_WEBHOOK_SECRET_TOKEN is not configured');
  }
  const encryptedToken = crypto
    .createHmac('sha256', secret)
    .update(plainToken)
    .digest('hex');

  return { plainToken, encryptedToken };
}

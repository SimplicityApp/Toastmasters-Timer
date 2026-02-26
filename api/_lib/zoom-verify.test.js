import crypto from 'node:crypto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { verifyZoomSignature, generateCrcResponse } from './zoom-verify.js';

const TEST_SECRET = 'test-webhook-secret-token';

beforeEach(() => {
  vi.stubEnv('ZOOM_WEBHOOK_SECRET_TOKEN', TEST_SECRET);
});

describe('generateCrcResponse', () => {
  it('returns plainToken and correct HMAC-SHA256 encryptedToken', () => {
    const plainToken = 'abc123';
    const result = generateCrcResponse(plainToken);

    const expected = crypto
      .createHmac('sha256', TEST_SECRET)
      .update(plainToken)
      .digest('hex');

    expect(result.plainToken).toBe(plainToken);
    expect(result.encryptedToken).toBe(expected);
  });
});

describe('verifyZoomSignature', () => {
  function createValidSignature(rawBody, timestamp) {
    const message = `v0:${timestamp}:${rawBody}`;
    const hash = crypto
      .createHmac('sha256', TEST_SECRET)
      .update(message)
      .digest('hex');
    return `v0=${hash}`;
  }

  it('returns true for a valid signature', () => {
    const rawBody = '{"event":"test"}';
    const timestamp = '1234567890';
    const signature = createValidSignature(rawBody, timestamp);

    const result = verifyZoomSignature(
      { 'x-zm-request-timestamp': timestamp, 'x-zm-signature': signature },
      rawBody
    );

    expect(result).toBe(true);
  });

  it('returns false for an invalid signature', () => {
    const rawBody = '{"event":"test"}';
    const timestamp = '1234567890';

    const result = verifyZoomSignature(
      { 'x-zm-request-timestamp': timestamp, 'x-zm-signature': 'v0=invalid' },
      rawBody
    );

    expect(result).toBe(false);
  });

  it('returns false when headers are missing', () => {
    expect(verifyZoomSignature({}, '{"event":"test"}')).toBe(false);
  });

  it('returns false when secret is not set', () => {
    vi.stubEnv('ZOOM_WEBHOOK_SECRET_TOKEN', '');

    const result = verifyZoomSignature(
      { 'x-zm-request-timestamp': '123', 'x-zm-signature': 'v0=abc' },
      '{}'
    );

    expect(result).toBe(false);
  });
});

import crypto from 'node:crypto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from './webhook.js';

const TEST_SECRET = 'test-webhook-secret-token';

// Mock fetch globally
const mockFetch = vi.fn(() =>
  Promise.resolve({ json: () => Promise.resolve({ access_token: 'mock-token' }) })
);
vi.stubGlobal('fetch', mockFetch);

function createMockReqRes(body, method = 'POST', extraHeaders = {}) {
  const rawBody = JSON.stringify(body);
  const req = {
    method,
    body,
    headers: { 'content-type': 'application/json', ...extraHeaders },
  };

  const res = {
    _status: null,
    _json: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(data) {
      this._json = data;
      return this;
    },
  };

  return { req, res, rawBody };
}

function signRequest(rawBody, timestamp = '1234567890') {
  const message = `v0:${timestamp}:${rawBody}`;
  const hash = crypto
    .createHmac('sha256', TEST_SECRET)
    .update(message)
    .digest('hex');
  return {
    'x-zm-request-timestamp': timestamp,
    'x-zm-signature': `v0=${hash}`,
  };
}

beforeEach(() => {
  vi.stubEnv('ZOOM_WEBHOOK_SECRET_TOKEN', TEST_SECRET);
  vi.stubEnv('POSTHOG_API_KEY', 'phc_test');
  vi.stubEnv('ZOOM_CLIENT_ID', 'test-client-id');
  vi.stubEnv('ZOOM_CLIENT_SECRET', 'test-client-secret');
  mockFetch.mockClear();
});

describe('POST /api/zoom/webhook', () => {
  it('rejects non-POST requests', async () => {
    const { req, res } = createMockReqRes({}, 'GET');
    await handler(req, res);
    expect(res._status).toBe(405);
  });

  describe('CRC validation (endpoint.url_validation)', () => {
    it('responds with plainToken and encryptedToken', async () => {
      const body = {
        event: 'endpoint.url_validation',
        payload: { plainToken: 'test-token-123' },
      };
      const { req, res } = createMockReqRes(body);

      await handler(req, res);

      expect(res._status).toBe(200);
      expect(res._json.plainToken).toBe('test-token-123');
      expect(res._json.encryptedToken).toBeDefined();
      expect(typeof res._json.encryptedToken).toBe('string');
    });

    it('returns 400 when plainToken is missing', async () => {
      const body = { event: 'endpoint.url_validation', payload: {} };
      const { req, res } = createMockReqRes(body);

      await handler(req, res);

      expect(res._status).toBe(400);
    });
  });

  describe('signature verification', () => {
    it('rejects requests with invalid signature', async () => {
      const body = { event: 'app_deauthorized', payload: { user_id: 'u1' } };
      const { req, res } = createMockReqRes(body, 'POST', {
        'x-zm-request-timestamp': '123',
        'x-zm-signature': 'v0=invalid',
      });

      await handler(req, res);

      expect(res._status).toBe(401);
    });
  });

  describe('app_deauthorized', () => {
    it('tracks uninstall event and returns 200', async () => {
      const body = {
        event: 'app_deauthorized',
        payload: { user_id: 'user-1', account_id: 'acct-1' },
      };
      const rawBody = JSON.stringify(body);
      const headers = signRequest(rawBody);
      const { req, res } = createMockReqRes(body, 'POST', headers);

      await handler(req, res);

      expect(res._status).toBe(200);
      expect(res._json.message).toBe('Uninstall tracked');

      // Check PostHog was called
      const posthogCall = mockFetch.mock.calls.find(
        (call) => call[0] === 'https://us.i.posthog.com/capture/'
      );
      expect(posthogCall).toBeDefined();
      const posthogBody = JSON.parse(posthogCall[1].body);
      expect(posthogBody.event).toBe('zoom_app_uninstalled');
      expect(posthogBody.properties.user_id).toBe('user-1');
    });
  });

  describe('meeting events', () => {
    it('tracks meeting.started event', async () => {
      const body = {
        event: 'meeting.started',
        payload: { object: { id: 'm1', host_id: 'h1', topic: 'Test' } },
      };
      const rawBody = JSON.stringify(body);
      const headers = signRequest(rawBody);
      const { req, res } = createMockReqRes(body, 'POST', headers);

      await handler(req, res);

      expect(res._status).toBe(200);
      expect(res._json.message).toBe('meeting.started tracked');

      const posthogCall = mockFetch.mock.calls.find(
        (call) => call[0] === 'https://us.i.posthog.com/capture/'
      );
      expect(posthogCall).toBeDefined();
      const posthogBody = JSON.parse(posthogCall[1].body);
      expect(posthogBody.event).toBe('zoom_meeting_started');
    });

    it('tracks meeting.ended event', async () => {
      const body = {
        event: 'meeting.ended',
        payload: { object: { id: 'm2', host_id: 'h2', topic: 'Done' } },
      };
      const rawBody = JSON.stringify(body);
      const headers = signRequest(rawBody);
      const { req, res } = createMockReqRes(body, 'POST', headers);

      await handler(req, res);

      expect(res._status).toBe(200);
      expect(res._json.message).toBe('meeting.ended tracked');
    });
  });

  describe('unknown events', () => {
    it('returns 200 for unrecognized events', async () => {
      const body = { event: 'some.unknown_event', payload: {} };
      const rawBody = JSON.stringify(body);
      const headers = signRequest(rawBody);
      const { req, res } = createMockReqRes(body, 'POST', headers);

      await handler(req, res);

      expect(res._status).toBe(200);
      expect(res._json.message).toBe('Event received');
    });
  });
});

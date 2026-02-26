import { verifyZoomSignature, generateCrcResponse } from '../_lib/zoom-verify.js';

/**
 * Send an event to PostHog via the HTTP capture API.
 */
async function capturePostHogEvent(eventName, properties = {}) {
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) return;

  try {
    await fetch('https://us.i.posthog.com/capture/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        event: eventName,
        properties: {
          distinct_id: properties.distinct_id || 'zoom-webhook',
          ...properties,
        },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.error('PostHog capture failed:', err.message);
  }
}

/**
 * Call Zoom's data compliance endpoint (required for Marketplace).
 */
async function notifyZoomCompliance(payload) {
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('Missing ZOOM_CLIENT_ID or ZOOM_CLIENT_SECRET for compliance');
    return;
  }

  const deauthorizationPayload = payload.payload || payload;
  const userId = deauthorizationPayload.user_id;
  const accountId = deauthorizationPayload.account_id;

  try {
    // Get access token via client credentials
    const tokenRes = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });
    const tokenData = await tokenRes.json();

    await fetch('https://api.zoom.us/oauth/data/compliance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenData.access_token}`,
      },
      body: JSON.stringify({
        client_id: clientId,
        user_id: userId,
        account_id: accountId,
        deauthorization_event_received: deauthorizationPayload,
        compliance_completed: true,
      }),
    });
  } catch (err) {
    console.error('Zoom compliance API call failed:', err.message);
  }
}

/**
 * Vercel serverless function handler for Zoom webhooks.
 * POST /api/zoom/webhook
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const event = body.event;

  // CRC validation — no signature check needed
  if (event === 'endpoint.url_validation') {
    const plainToken = body.payload?.plainToken;
    if (!plainToken) {
      return res.status(400).json({ error: 'Missing plainToken' });
    }
    const crcResponse = generateCrcResponse(plainToken);
    return res.status(200).json(crcResponse);
  }

  // All other events require signature verification
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  if (!verifyZoomSignature(req.headers, rawBody)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Handle specific events
  if (event === 'app_deauthorized') {
    const payload = body.payload;
    const userId = payload?.user_id;
    const accountId = payload?.account_id;

    await capturePostHogEvent('zoom_app_uninstalled', {
      distinct_id: userId || 'unknown',
      user_id: userId,
      account_id: accountId,
    });

    // Fire-and-forget compliance call (don't block the 3s response window)
    notifyZoomCompliance(body).catch((err) =>
      console.error('Compliance call error:', err.message)
    );

    return res.status(200).json({ message: 'Uninstall tracked' });
  }

  if (event === 'meeting.started' || event === 'meeting.ended') {
    const payload = body.payload?.object || {};

    await capturePostHogEvent(`zoom_${event.replace('.', '_')}`, {
      distinct_id: payload.host_id || 'unknown',
      meeting_id: payload.id,
      host_id: payload.host_id,
      topic: payload.topic,
    });

    return res.status(200).json({ message: `${event} tracked` });
  }

  // Unknown events — log and return 200 (Zoom requires 200/204 within 3s)
  console.log('Unhandled Zoom webhook event:', event);
  return res.status(200).json({ message: 'Event received' });
}

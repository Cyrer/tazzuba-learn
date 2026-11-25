// Verifies a Pi access token with the Pi Platform API and returns the user.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { accessToken } = req.body || {};
  if (!accessToken) return res.status(400).json({ error: 'Missing accessToken' });
  try {
    const r = await fetch('https://api.minepi.com/v2/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!r.ok) return res.status(401).json({ error: 'Invalid Pi session' });
    const me = await r.json();
    return res.status(200).json({ uid: me.uid, username: me.username });
  } catch (e) {
    return res.status(502).json({ error: 'Could not reach Pi' });
  }
}

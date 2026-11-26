// Checks a premium pass for the signed-in user.
import { json, piMe, readPass } from './_pi.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  try {
    const { token, accessToken } = req.body || {};
    const me = await piMe(accessToken);
    if (!me) return json(res, 401, { error: 'Sign in with Pi again' });
    const pass = readPass(token);
    const premium = !!pass && pass.uid === me.uid && pass.exp > Date.now();
    return json(res, 200, { premium, expires: premium ? pass.exp : null });
  } catch (e) {
    return json(res, 400, { error: e.message });
  }
}

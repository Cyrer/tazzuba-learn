import { json, piMe, piGetPayment, piPost, validatePayment } from '../_pi.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  try {
    const { paymentId, accessToken } = req.body || {};
    const me = await piMe(accessToken);
    if (!me) return json(res, 401, { error: 'Sign in with Pi again' });
    const payment = await piGetPayment(paymentId);
    validatePayment(payment, me.uid);
    if (payment.status?.developer_approved) return json(res, 200, { approved: true });
    const r = await piPost(paymentId, 'approve');
    if (!r.ok) return json(res, 502, { error: `Pi approve failed (${r.status})` });
    return json(res, 200, { approved: true });
  } catch (e) {
    return json(res, 400, { error: e.message });
  }
}

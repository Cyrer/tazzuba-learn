import { json, piMe, piGetPayment, finish } from '../_pi.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  try {
    const { paymentId, txid, accessToken } = req.body || {};
    const me = await piMe(accessToken);
    if (!me) return json(res, 401, { error: 'Sign in with Pi again' });
    const payment = await piGetPayment(paymentId);
    if (payment.user_uid !== me.uid) return json(res, 403, { error: 'Not your payment' });
    const pass = await finish(payment, txid);
    return json(res, 200, { premium: true, ...pass });
  } catch (e) {
    return json(res, 400, { error: e.message });
  }
}

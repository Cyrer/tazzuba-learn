// Called when Pi finds a payment that was paid but never finished (e.g. the app closed).
// We look the payment up ourselves; the browser's copy is only used for its id.
import { json, piGetPayment, finish } from '../_pi.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  try {
    const id = req.body?.payment?.identifier;
    if (!id) return json(res, 400, { error: 'Missing payment' });
    const payment = await piGetPayment(id);
    if (!payment.transaction?.txid) return json(res, 200, { premium: false, pending: true });
    const pass = await finish(payment);
    return json(res, 200, { premium: true, uid: payment.user_uid, ...pass });
  } catch (e) {
    return json(res, 400, { error: e.message });
  }
}

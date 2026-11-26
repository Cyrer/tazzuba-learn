// Tazzuba Learn: Pi payments server (all in one file).
import crypto from 'node:crypto';

const PI_API = 'https://api.minepi.com';

// Server-owned product catalogue: the browser can never change price or length.
const PRODUCTS = {
  premium_month: { amount: 1, days: 30, memo: 'Tazzuba Learn Premium (1 month)' }
};

function json(res, code, body) {
  res.status(code).setHeader('Cache-Control', 'no-store');
  return res.json(body);
}

function apiKey() {
  const k = process.env.PI_NETWORK_API_KEY;
  if (!k) throw new Error('PI_NETWORK_API_KEY is not set');
  return k;
}

// Who is the signed-in Pi user? (verifies the access token with Pi)
async function piMe(accessToken) {
  if (!accessToken) return null;
  const r = await fetch(`${PI_API}/v2/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) return null;
  return r.json();
}

async function piGetPayment(id) {
  const r = await fetch(`${PI_API}/v2/payments/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Key ${apiKey()}` }
  });
  if (!r.ok) throw new Error(`Pi get payment failed (${r.status})`);
  return r.json();
}

async function piPost(id, action, body) {
  const r = await fetch(`${PI_API}/v2/payments/${encodeURIComponent(id)}/${action}`, {
    method: 'POST',
    headers: { Authorization: `Key ${apiKey()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  let data = null; try { data = JSON.parse(text); } catch {}
  return { ok: r.ok, status: r.status, data };
}

// Checks a payment against the server-owned catalogue. Returns the product or throws.
function validatePayment(p, expectUid) {
  const productId = p?.metadata?.product;
  const product = PRODUCTS[productId];
  if (!product) throw new Error('Unknown product');
  if (Number(p.amount) !== product.amount) throw new Error('Wrong amount');
  if (p.direction && p.direction !== 'user_to_app') throw new Error('Wrong direction');
  if (expectUid && p.user_uid !== expectUid) throw new Error('Payment belongs to another user');
  if (p.status?.cancelled || p.status?.user_cancelled) throw new Error('Payment cancelled');
  return { productId, ...product };
}

// ---- Premium pass: a signed, tamper-proof token (no database needed) ----
function secret() {
  const s = process.env.ENTITLEMENT_SECRET;
  if (!s || s.length < 32) throw new Error('ENTITLEMENT_SECRET is not set (32+ characters)');
  return s;
}
const b64 = s => Buffer.from(s).toString('base64url');
const sign = data => crypto.createHmac('sha256', secret()).update(data).digest('base64url');

// Same payment always produces the same pass, so retries are safe.
function issuePass(payment, product) {
  const start = Date.parse(payment.created_at) || Date.now();
  const body = { uid: payment.user_uid, pid: payment.identifier, exp: start + product.days * 864e5 };
  const data = b64(JSON.stringify(body));
  return { token: `${data}.${sign(data)}`, expires: body.exp };
}

function readPass(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  const good = sign(data);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try { return JSON.parse(Buffer.from(data, 'base64url').toString()); } catch { return null; }
}

// Finishes a paid payment (idempotent) and returns a pass.
async function finish(payment, txid) {
  const product = validatePayment(payment);
  const tx = payment.transaction;
  if (!tx || !tx.txid) throw new Error('No blockchain transaction yet');
  if (txid && tx.txid !== txid) throw new Error('Transaction id mismatch');
  if (!payment.status?.developer_completed) {
    const r = await piPost(payment.identifier, 'complete', { txid: tx.txid });
    if (!r.ok && r.status !== 400) throw new Error(`Pi complete failed (${r.status})`);
    payment = await piGetPayment(payment.identifier);
  }
  if (!payment.status?.developer_completed) throw new Error('Payment not completed');
  if (payment.status?.transaction_verified === false) throw new Error('Transaction not verified');
  return issuePass(payment, product);
}

// ---- One endpoint for everything: /api/pi?action=approve|complete|incomplete|entitlement ----
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const action = req.query?.action || new URL(req.url, 'http://x').searchParams.get('action');
  const b = req.body || {};
  try {
    if (action === 'approve') {
      const me = await piMe(b.accessToken);
      if (!me) return json(res, 401, { error: 'Sign in with Pi again' });
      const payment = await piGetPayment(b.paymentId);
      validatePayment(payment, me.uid);
      if (payment.status?.developer_approved) return json(res, 200, { approved: true });
      const r = await piPost(b.paymentId, 'approve');
      if (!r.ok) return json(res, 502, { error: `Pi approve failed (${r.status})` });
      return json(res, 200, { approved: true });
    }
    if (action === 'complete') {
      const me = await piMe(b.accessToken);
      if (!me) return json(res, 401, { error: 'Sign in with Pi again' });
      const payment = await piGetPayment(b.paymentId);
      if (payment.user_uid !== me.uid) return json(res, 403, { error: 'Not your payment' });
      const pass = await finish(payment, b.txid);
      return json(res, 200, { premium: true, ...pass });
    }
    if (action === 'incomplete') {
      const id = b.payment?.identifier;
      if (!id) return json(res, 400, { error: 'Missing payment' });
      const payment = await piGetPayment(id);
      if (!payment.transaction?.txid) return json(res, 200, { premium: false, pending: true });
      const pass = await finish(payment);
      return json(res, 200, { premium: true, uid: payment.user_uid, ...pass });
    }
    if (action === 'entitlement') {
      const me = await piMe(b.accessToken);
      if (!me) return json(res, 401, { error: 'Sign in with Pi again' });
      const pass = readPass(b.token);
      const premium = !!pass && pass.uid === me.uid && pass.exp > Date.now();
      return json(res, 200, { premium, expires: premium ? pass.exp : null });
    }
    return json(res, 404, { error: 'Unknown action' });
  } catch (e) {
    return json(res, 400, { error: e.message });
  }
}

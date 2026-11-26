// Serves the Pi domain-ownership key from an environment variable,
// so the key is never stored in the code.
export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(process.env.PI_VALIDATION_KEY || '');
}

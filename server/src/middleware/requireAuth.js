// Protects a route: only lets the request through if it carries a valid JWT.
const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  // Expected header: "Authorization: Bearer <token>"
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId; // later handlers use this to scope queries to the user
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = requireAuth;

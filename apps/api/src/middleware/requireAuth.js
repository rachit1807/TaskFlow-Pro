import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function requireAuth(request, response, next) {
  const token = request.cookies?.taskflow_session;
  if (!token) return response.status(401).json({ error: { message: 'Sign in to continue.' } });
  if (!process.env.JWT_SECRET) return response.status(503).json({ error: { message: 'Authentication is not configured yet.' } });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { issuer: 'taskflow-pro' });
  } catch {
    response.clearCookie('taskflow_session', cookieOptions());
    return response.status(401).json({ error: { message: 'Your session has expired. Sign in again.' } });
  }

  const user = await User.findById(payload.sub);
  if (!user) return response.status(401).json({ error: { message: 'Your session is no longer valid.' } });
  request.user = user;
  return next();
}

export function cookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' };
}

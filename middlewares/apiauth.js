const jwt = require('jsonwebtoken');
const config = require('config');
const User = require('../models/User');

async function apiauth(req, res, next) {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).send('Access denied. No token provided.');

  try {
    const decoded = jwt.verify(token, config.get('jwtPrivateKey'));
    const user = await User.findById(decoded._id).select('-password');

    if (!user) return res.status(401).send('Invalid token.');

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).send('Invalid or expired token.');
  }
}

module.exports = apiauth;

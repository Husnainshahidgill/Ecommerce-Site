//this middleware secures api routes using jwt
const jwt = require('jsonwebtoken'); //import the jwt pkg
const config = require('config'); //rread config jwt private key
const User = require('../models/User');

async function apiauth(req, res, next) {
  const token = req.header('x-auth-token'); // its like a wristband for api access
  if (!token) return res.status(401).send('Access denied. No token provided.');

  try {
    const decoded = jwt.verify(token, config.get('jwtPrivateKey')); //check if token is valid; created by server
    const user = await User.findById(decoded._id).select('-password'); //since we got id from token, fetch user details from db

    if (!user) return res.status(401).send('Invalid token.');

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).send('Invalid or expired token.');
  }
}

module.exports = apiauth;

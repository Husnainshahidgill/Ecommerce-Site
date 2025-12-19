var express = require('express');
var router = express.Router();
var User = require('../../models/User');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const config = require('config');
const bcrypt = require('bcryptjs');

router.post('/', async function (req, res) {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(400).send('Invalid Email or Password');

    const validPassword = await bcrypt.compare(
      req.body.password,
      user.password
    );
    if (!validPassword)
      return res.status(400).send('Invalid Email or Password');

    const token = jwt.sign(
      {
        _id: user._id,
        roles: user.roles,
        name: user.name,
        email: user.email,
      },
      config.get('jwtPrivateKey'),
      { expiresIn: '7d' }
    );

    return res.send(token);
  } catch (err) {
    return res.status(500).send('Server error');
  }
});

module.exports = router;

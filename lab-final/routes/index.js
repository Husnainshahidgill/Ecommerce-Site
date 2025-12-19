var express = require('express');
var router = express.Router();
var Product = require('../models/Product');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

router.get('/login', function (req, res, next) {
  return res.render('site/login');
});

router.post('/login', async function (req, res) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email?.trim() });

    if (!user) {
      req.flash('danger', 'User with this email not present');
      return res.redirect('/login');
    }

    if (!user.password) {
      req.flash(
        'danger',
        'This account has no password set in database. Please re-register or reset the password.'
      );
      return res.redirect('/login');
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      req.flash('danger', 'Invalid Password');
      return res.redirect('/login');
    }

    req.session.user = user;
    req.flash('success', 'Logged in Successfully');
    return res.redirect('/');
  } catch (err) {
    console.error('Login error:', err);
    req.flash('danger', 'Login failed. Try again.');
    return res.redirect('/login');
  }
});

router.get('/register', function (req, res, next) {
  return res.render('site/register');
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

router.post('/register', async function (req, res, next) {
  //check duplicate email
  let user = await User.findOne({ email: req.body.email });
  if (user) {
    req.flash('danger', 'User with given email already registered');
    return res.redirect('/register');
  }

  user = new User({
    name: req.body.name,
    email: req.body.email,

    roles: ['customer'],
  });

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(req.body.password, salt);

  await user.save();
  req.flash('success', 'Registered Successfully. Please login.');
  return res.redirect('/login');
});

router.get('/contact-us', function (req, res, next) {
  return res.render('site/contact', { layout: 'layout' });
});

module.exports = router;

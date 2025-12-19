async function checkSessionAuth(req, res, next) {
  //if user is not logged in, redirect to login
  if (!req.session.user) {
    req.flash('danger', 'You need to login for this route');
    return res.redirect('/login');
  }
  next();
}

module.exports = checkSessionAuth;

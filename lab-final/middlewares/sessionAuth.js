async function sessionAuth(req, res, next) {
  // If user is not logged in, req.session.user might be undefined so u set it to null
  if (!req.session.user) req.session.user = null;

  //if user is logged in, make user data available in all views
  res.locals.user = req.session.user;

  // ✅ safe roles array
  const roles = req.session.user?.roles || [];

  // ✅ superadmin flag
  res.locals.isSuperAdmin = roles.includes('superadmin');

  // ✅ admin flag should include superadmin too
  // This establishes a hierarchy: If you are a Super Admin, the system automatically
  //  treats you as an Admin too.
  res.locals.isAdmin = roles.includes('admin') || res.locals.isSuperAdmin;

  // flash helper
  // this to solve http amnresia
  req.flash = function (type, message) {
    req.session.flash = { type, message };
  };

  if (req.session.flash) {
    res.locals.flash = req.session.flash;
    req.session.flash = null;
  }

  next();
}

module.exports = sessionAuth;

// sessionAuth.js
// Think of it as a "Butler" that runs before every single page load.
//  Its job is to check who the user is, what powers (roles) they have,
// and if there are any messages (like "Login Successful") waiting to be shown.
// It then unpacks all this info so your HTML/EJS files can use it easily.

async function sessionAuth(req, res, next) {
  // normalize session user
  if (!req.session.user) req.session.user = null;

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

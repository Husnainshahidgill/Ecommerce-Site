// module.exports = async function (req, res, next) {
//   res.locals.layout = "super-admin-layout";
//   res.locals.title = "Awesome Store Admin Panel";
//   next();
// };

//bug: anyone can get to the superadmin dashboard because it is exposed to public. no checking of roles

module.exports = async function (req, res, next) {
  res.locals.layout = 'super-admin-layout';
  res.locals.title = 'Awesome Store Admin Panel';

  const user = req.session.user || null;
  const roles = (user && user.roles) || [];

  // 1) not logged in → send to login
  if (!user) {
    // no req.flash here because sessionAuth hasn't run yet
    return res.redirect('/login');
  }

  // 2) logged in but not admin / superadmin → block
  const isAdmin = roles.includes('admin') || roles.includes('superadmin');
  if (!isAdmin) {
    // you can also redirect to "/" if you prefer
    return res.status(403).send('Access denied. Admins only.');
  }

  // 3) user is admin/superadmin → allow
  next();
};

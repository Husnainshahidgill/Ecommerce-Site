const cartAuth = {
  checkCartNotEmpty: (req, res, next) => {
    let cart = req.cookies.cart;

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      req.flash(
        'danger',
        'Your cart is empty. Add some products before checking out!'
      );
      return res.redirect('/cart');
    }

    next();
  },

  /* MIDDLEWARE: adminOnly
  Objective: Restrict access to specific sensitive routes.
  Why use this: Instead of writing 'if(user.email == ...)' in every single admin route, 
  we centralize the logic here. This follows the DRY (Don't Repeat Yourself) principle.
  If we ever need to change the admin email, we only change it in this one file.
*/

  adminOnly: (req, res, next) => {
    const user = req.session.user;

    if (user && user.email === 'admin@shop.com') {
      return next();
    }

    req.flash(
      'danger',
      'Access Denied: This area is restricted to the specific Admin email.'
    );
    res.redirect('/login');
  },
};

module.exports = cartAuth;

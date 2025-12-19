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

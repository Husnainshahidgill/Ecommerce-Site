const express = require('express');
let router = express.Router();
const Product = require('../../models/Product');
const User = require('../../models/User');
const Order = require('../../models/Order');

router.get('/', async (req, res) => {
  try {
    const [totalProducts, totalCustomers, totalOrders] = await Promise.all([
      Product.countDocuments(),
      User.countDocuments({
        roles: 'customer',
        roles: { $nin: ['admin', 'super-admin'] },
      }),
      Order.countDocuments(),
    ]);

    return res.render('super-admin/dashboard', {
      totalProducts,
      totalCustomers,
      totalOrders,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return res.render('super-admin/dashboard', {
      totalProducts: 0,
      totalCustomers: 0,
      totalOrders: 0,
    });
  }
});

module.exports = router;

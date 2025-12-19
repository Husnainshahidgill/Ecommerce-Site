const express = require('express');
const router = express.Router();
const Order = require('../../models/Order');

// Use only the first gate for now to see if the 404 disappears
router.get('/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdDate: -1 });
    res.render('super-admin/orders/list', { orders });
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Keep protection on the action routes
router.post('/orders/confirm/:id', async (req, res) => {
  await Order.findByIdAndUpdate(req.params.id, { status: 'Confirmed' });
  res.redirect('/super-admin/orders');
});

module.exports = router;

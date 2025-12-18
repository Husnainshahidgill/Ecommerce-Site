var express = require('express');
var router = express.Router();
var Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');

// VIEW CART
router.get('/cart', async function (req, res, next) {
  let cart = req.cookies.cart;
  if (!Array.isArray(cart)) cart = [];

  // normalize old format: ["id","id"] -> [{id, qty:1}]
  cart = cart.map((item) =>
    typeof item === 'string' ? { id: item, qty: 1 } : item
  );

  // remove bad entries
  cart = cart.filter((x) => x && x.id);

  const ids = cart.map((x) => x.id);
  const products = await Product.find({ _id: { $in: ids } });

  const qtyMap = new Map(cart.map((x) => [String(x.id), Number(x.qty || 1)]));

  const items = products.map((p) => {
    const qty = qtyMap.get(String(p._id)) || 1;
    const unitPrice = Number(p.price || 0);
    return {
      product: p,
      qty,
      unitPrice,
      lineTotal: unitPrice * qty,
    };
  });

  const total = items.reduce((sum, it) => sum + it.lineTotal, 0);

  // update cookie with normalized data
  res.cookie('cart', cart);

  res.render('site/cart', { items, total });
});

// ADD TO CART (FROM PRODUCT DETAIL) — must be POST
router.post('/add-cart/:id', async function (req, res, next) {
  const productId = req.params.id;

  let qty = Number(req.body.qty || 1);
  if (!qty || qty < 1) qty = 1;

  const product = await Product.findById(productId);
  if (!product) {
    req.flash('danger', 'Product not found');
    return res.redirect('/');
  }

  const available = Number(product.quantity || 0);
  if (available <= 0) {
    req.flash('danger', 'Out of stock');
    return res.redirect('/product/' + productId);
  }

  let cart = req.cookies.cart;
  if (!Array.isArray(cart)) cart = [];

  cart = cart.map((item) =>
    typeof item === 'string' ? { id: item, qty: 1 } : item
  );
  cart = cart.filter((x) => x && x.id);

  const existing = cart.find((x) => String(x.id) === String(productId));
  const already = existing ? Number(existing.qty || 0) : 0;

  const newQty = Math.min(already + qty, available);

  if (existing) existing.qty = newQty;
  else cart.push({ id: productId, qty: newQty });

  res.cookie('cart', cart);
  req.flash('success', `Added to cart (Qty: ${newQty})`);
  return res.redirect('/cart');
});

// UPDATE QUANTITY (FROM CART) — must be POST
router.post('/cart/update/:id', async function (req, res) {
  try {
    const productId = req.params.id;
    let qty = Number(req.body.qty || 1);
    if (!qty || qty < 1) qty = 1;

    const product = await Product.findById(productId);
    if (!product) return res.redirect('/cart');

    const available = Number(product.quantity || 0);

    // clamp qty
    qty = Math.min(qty, available);

    let cart = req.cookies.cart;
    if (!Array.isArray(cart)) cart = [];
    cart = cart.map((item) =>
      typeof item === 'string' ? { id: item, qty: 1 } : item
    );

    const existing = cart.find((x) => String(x.id) === String(productId));
    if (existing) {
      if (available <= 0) {
        // if out of stock now, remove it
        cart = cart.filter((x) => String(x.id) !== String(productId));
      } else {
        existing.qty = qty;
      }
    }

    res.cookie('cart', cart);
    return res.redirect('/cart');
  } catch (e) {
    console.error(e);
    return res.redirect('/cart');
  }
});

// REMOVE ITEM (FROM CART) — must be POST
router.post('/cart/remove/:id', function (req, res) {
  const productId = req.params.id;

  let cart = req.cookies.cart;
  if (!Array.isArray(cart)) cart = [];
  cart = cart.map((item) =>
    typeof item === 'string' ? { id: item, qty: 1 } : item
  );

  cart = cart.filter((x) => String(x.id) !== String(productId));

  res.cookie('cart', cart);
  return res.redirect('/cart');
});

// GET - Checkout page (summary)
router.get('/checkout', async function (req, res) {
  let cart = req.cookies.cart;
  if (!Array.isArray(cart)) cart = [];

  // normalize old format
  cart = cart.map((item) =>
    typeof item === 'string' ? { id: item, qty: 1 } : item
  );
  cart = cart.filter((x) => x && x.id);

  const ids = cart.map((x) => x.id);
  const products = await Product.find({ _id: { $in: ids } });

  const qtyMap = new Map(cart.map((x) => [String(x.id), Number(x.qty || 1)]));

  const items = products.map((p) => {
    const qty = qtyMap.get(String(p._id)) || 1;
    const unitPrice = Number(p.price || 0);
    return {
      product: p,
      qty,
      unitPrice,
      lineTotal: unitPrice * qty,
    };
  });

  const total = items.reduce((sum, it) => sum + it.lineTotal, 0);

  return res.render('site/checkout', { items, total });
});

// POST - Place order
router.post('/checkout', async function (req, res) {
  try {
    // must be logged in (your sessionAuth already runs on / routes)
    const user = req.session.user;
    if (!user) {
      req.flash('danger', 'Please login first.');
      return res.redirect('/login');
    }

    let cart = req.cookies.cart;
    if (!Array.isArray(cart)) cart = [];

    cart = cart.map((item) =>
      typeof item === 'string' ? { id: item, qty: 1 } : item
    );
    cart = cart.filter((x) => x && x.id);

    if (cart.length === 0) {
      req.flash('danger', 'Cart is empty.');
      return res.redirect('/cart');
    }

    const ids = cart.map((x) => x.id);
    const products = await Product.find({ _id: { $in: ids } });

    const qtyMap = new Map(cart.map((x) => [String(x.id), Number(x.qty || 1)]));

    // Validate stock + build order items
    const orderItems = [];
    let total = 0;

    for (const p of products) {
      const requestedQty = qtyMap.get(String(p._id)) || 0;
      const available = Number(p.quantity || 0);

      if (requestedQty <= 0) continue;

      if (available < requestedQty) {
        req.flash(
          'danger',
          `Not enough stock for "${p.name}". Available: ${available}`
        );
        return res.redirect('/cart');
      }

      const unitPrice = Number(p.price || 0);
      total += unitPrice * requestedQty;

      orderItems.push({
        product: p._id,
        name: p.name,
        price: unitPrice,
        qty: requestedQty,
      });
    }

    if (orderItems.length === 0) {
      req.flash('danger', 'Cart is empty.');
      return res.redirect('/cart');
    }

    // Create order
    const order = await Order.create({
      user: user._id,
      items: orderItems,
      total,
      status: 'pending',
    });

    // Reduce stock
    for (const item of orderItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { quantity: -item.qty },
      });
    }

    // Clear cart
    res.cookie('cart', []);
    req.flash('success', 'Order placed successfully!');
    return res.redirect('/cart');
  } catch (err) {
    console.error('Checkout error:', err);
    req.flash('danger', 'Checkout failed.');
    return res.redirect('/cart');
  }
});

router.get('/categories', async function (req, res, next) {
  // (your categories logic is incomplete, but keeping your render)
  let catagories = await Category.find();

  return res.render('site/collections/Catetorys', {
    Category_title: 'All Categories',
    catagories,
  });
});

// keep this last
router.get('/:page?', async function (req, res, next) {
  let page = Number(req.params.page);
  if (!page || page < 1) page = 1;

  const pageSize = 12;
  const skip = (page - 1) * pageSize;

  const dept = (req.query.dept || '').trim();
  const min = req.query.min ? Number(req.query.min) : null;
  const max = req.query.max ? Number(req.query.max) : null;

  const departments = await Product.distinct('department');

  // keep filters in pagination links
  const queryObj = {};
  if (dept) queryObj.dept = dept;
  if (min !== null && !Number.isNaN(min)) queryObj.min = String(min);
  if (max !== null && !Number.isNaN(max)) queryObj.max = String(max);
  const qs = new URLSearchParams(queryObj).toString();

  // build match for aggregation
  const match = {};
  if (dept) match.department = dept;

  if (min !== null || max !== null) {
    match.priceNum = {};
    if (min !== null && !Number.isNaN(min)) match.priceNum.$gte = min;
    if (max !== null && !Number.isNaN(max)) match.priceNum.$lte = max;
  }

  const products = await Product.aggregate([
    { $addFields: { priceNum: { $toDouble: '$price' } } },
    { $match: match },
    { $skip: skip },
    { $limit: pageSize },
  ]);

  const countArr = await Product.aggregate([
    { $addFields: { priceNum: { $toDouble: '$price' } } },
    { $match: match },
    { $count: 'total' },
  ]);

  const totalProducts = countArr[0]?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalProducts / pageSize));

  return res.render('site/homepage', {
    pagetitle: 'Awesome Products',
    products,
    page,
    pageSize,
    totalPages,
    departments,
    filters: { dept, min: min ?? '', max: max ?? '' },
    qs,
  });
});

module.exports = router;

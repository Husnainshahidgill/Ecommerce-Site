var express = require('express');
var router = express.Router();
var Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const { checkCartNotEmpty } = require('../middlewares/cartAuth');

router.get('/cart', async function (req, res, next) {
  let cart = req.cookies.cart; //cookies to store cart
  if (!Array.isArray(cart)) cart = [];

  // normalize cart items (string to object)
  let cleanCart = [];

  for (const item of cart) {
    if (typeof item === 'string') {
      cleanCart.push({ id: item, qty: 1 });
    } else {
      cleanCart.push(item);
    }
  }

  cart = cleanCart;

  // remove bad entries. if null/undefined id, remove it
  cart = cart.filter((x) => x && x.id);

  const ids = [];

  //collect id
  for (const item of cart) {
    ids.push(item.id);
  }

  //getting full product objects
  const products = await Product.find({ _id: { $in: ids } });

  const qtyMap = {};

  cart.forEach((item) => {
    qtyMap[item.id] = Number(item.qty || 1);
  }); // storing quantity against producty id

  const items = [];

  for (const p of products) {
    const qty = qtyMap[p._id] || 1;
    const price = Number(p.price || 0);

    items.push({
      product: p,
      qty: qty,
      unitPrice: price,
      lineTotal: qty * price,
    });
  }

  const total = items.reduce((sum, it) => sum + it.lineTotal, 0);

  // update cookie with normalized data
  res.cookie('cart', cart);

  res.render('site/cart', { items, total });
});

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

router.get('/checkout', checkCartNotEmpty, async function (req, res) {
  let cart = req.cookies.cart;
  if (!Array.isArray(cart)) cart = [];

  let cleanCart = [];

  for (const item of cart) {
    if (typeof item === 'string') {
      cleanCart.push({ id: item, qty: 1 });
    } else {
      cleanCart.push(item);
    }
  }

  cart = cleanCart;

  cart = cart.filter((x) => x && x.id);

  const ids = [];

  for (const item of cart) {
    ids.push(item.id);
  }

  const products = await Product.find({ _id: { $in: ids } });

  const qtyMap = {};

  for (const item of cart) {
    qtyMap[item.id] = Number(item.qty || 1);
  }

  const items = [];

  for (const p of products) {
    const qty = qtyMap[p._id] || 1;

    const unitPrice = Number(p.price || 0);

    items.push({
      product: p,
      qty: qty,
      unitPrice: unitPrice,
      lineTotal: unitPrice * qty,
    });
  }

  const total = items.reduce((sum, it) => sum + it.lineTotal, 0);

  return res.render('site/checkout', { items, total });
});

router.post('/checkout', checkCartNotEmpty, async function (req, res) {
  try {
    // 1. Get Customer details from the form (Lab Requirement)
    const { customerName, customerEmail } = req.body;

    if (!customerName || !customerEmail) {
      req.flash('danger', 'Please provide your name and email.');
      return res.redirect('/checkout');
    }

    // 2. Get Cart from Cookies
    let cart = req.cookies.cart;
    if (!Array.isArray(cart)) cart = [];

    // Normalize cart
    cart = cart
      .map((item) => (typeof item === 'string' ? { id: item, qty: 1 } : item))
      .filter((x) => x && x.id);

    if (cart.length === 0) {
      req.flash('danger', 'Cart is empty.');
      return res.redirect('/cart');
    }

    // 3. Fetch Products and Validate Stock
    const ids = cart.map((item) => item.id);
    const products = await Product.find({ _id: { $in: ids } });

    const orderItems = [];
    let totalAmount = 0;

    for (const p of products) {
      // Fix: qtyMap is an object, use bracket notation
      const itemInCart = cart.find((c) => String(c.id) === String(p._id));
      const requestedQty = itemInCart ? Number(itemInCart.qty) : 0;
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
      totalAmount += unitPrice * requestedQty;

      orderItems.push({
        product: p._id,
        name: p.name,
        price: unitPrice,
        qty: requestedQty,
      });
    }

    // 4. Create Order (Using Lab Requirements: Name, Email, Status)
    const order = await Order.create({
      customerName,
      customerEmail,
      items: orderItems,
      totalAmount,
      status: 'Pending', // Lab Requirement: Capitalized 'Pending'
    });

    // 5. Reduce Stock
    for (const item of orderItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { quantity: -item.qty },
      });
    }

    // 6. Clear Cart (Lab Requirement)
    res.clearCookie('cart');

    // 7. Redirect to Confirmation (Lab Requirement: Display Order ID)
    return res.render('site/confirmation', { orderId: order._id });
  } catch (err) {
    console.error('Checkout error:', err);
    req.flash('danger', 'Checkout failed.');
    return res.redirect('/cart');
  }
});

router.get('/categories', async function (req, res, next) {
  let catagories = await Category.find();

  return res.render('site/collections/Catetorys', {
    Category_title: 'All Categories',
    catagories,
  });
});

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

  //makes pages for the last 2 products
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

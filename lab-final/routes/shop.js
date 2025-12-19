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

/* ROUTE: POST /checkout
  Objective: Transition transient cart data into a persistent database Order.
  Logic: 
  1. Recalculates total on the server to prevent price tampering.
  2. Updates Product inventory using $inc to ensure stock is reduced.
  3. Clears the user's session/cookie cart only AFTER the order is successfully saved.
*/

router.post('/checkout', checkCartNotEmpty, async function (req, res) {
  try {
    const { customerName, customerEmail } = req.body;

    if (!customerName || customerName.trim().length < 3) {
      req.flash(
        'danger',
        'Please provide a valid full name (min 3 characters).'
      );
      return res.redirect('/checkout');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!customerEmail || !emailRegex.test(customerEmail)) {
      req.flash('danger', 'Please provide a valid email address.');
      return res.redirect('/checkout');
    }

    let cart = req.cookies.cart;
    if (!Array.isArray(cart)) cart = [];

    cart = cart
      .map((item) => (typeof item === 'string' ? { id: item, qty: 1 } : item))
      .filter((x) => x && x.id);

    if (cart.length === 0) {
      req.flash('danger', 'Your session has expired or the cart is empty.');
      return res.redirect('/cart');
    }

    const ids = cart.map((item) => item.id);
    const products = await Product.find({ _id: { $in: ids } });

    const orderItems = [];
    let serverRecalculatedTotal = 0;

    for (const p of products) {
      const itemInCart = cart.find((c) => String(c.id) === String(p._id));
      const requestedQty = itemInCart ? Number(itemInCart.qty) : 0;
      const availableStock = Number(p.quantity || 0);

      if (requestedQty <= 0) continue;

      if (availableStock < requestedQty) {
        req.flash(
          'danger',
          `Inventory error: "${p.name}" only has ${availableStock} units left.`
        );
        return res.redirect('/cart');
      }

      const unitPrice = Number(p.price || 0);

      serverRecalculatedTotal += unitPrice * requestedQty;

      orderItems.push({
        product: p._id,
        name: p.name,
        price: unitPrice,
        qty: requestedQty,
      });
    }

    if (orderItems.length === 0) {
      req.flash('danger', 'Items in your cart are no longer available.');
      return res.redirect('/cart');
    }

    const order = await Order.create({
      customerName: customerName.trim(),
      customerEmail: customerEmail.toLowerCase().trim(),
      items: orderItems,
      totalAmount: serverRecalculatedTotal,
      status: 'Pending',
    });

    for (const item of orderItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { quantity: -item.qty },
      });
    }

    res.clearCookie('cart');

    return res.render('site/confirmation', { orderId: order._id });
  } catch (err) {
    console.error('Checkout error:', err);
    req.flash('danger', 'An internal error occurred during checkout.');
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

/* ROUTE: GET /:page?
  DESCRIPTION: This is the main shop landing page. It handles three complex features:
  1. Pagination: Using 'skip' and 'limit' to show only 12 products at a time.
  2. Dynamic Filtering: Filtering by department and price range using MongoDB Aggregation.
  3. Price Conversion: Converting string prices to doubles on-the-fly for accurate numerical filtering.
*/
router.get('/:page?', async function (req, res, next) {
  // Task 5 Fix: Wrapped in try-catch to handle async database errors gracefully
  try {
    let page = Number(req.params.page);
    if (!page || page < 1) page = 1;

    const pageSize = 12;
    const skip = (page - 1) * pageSize;

    // Sanitize query parameters for filtering
    const dept = (req.query.dept || '').trim();
    const min = req.query.min ? Number(req.query.min) : null;
    const max = req.query.max ? Number(req.query.max) : null;

    // Fetch unique departments for the sidebar filter
    const departments = await Product.distinct('department');

    // Build query object to persist filter state in pagination links (QueryString)
    const queryObj = {};
    if (dept) queryObj.dept = dept;
    if (min !== null && !Number.isNaN(min)) queryObj.min = String(min);
    if (max !== null && !Number.isNaN(max)) queryObj.max = String(max);
    const qs = new URLSearchParams(queryObj).toString();

    // Construct the MongoDB Match object for the Aggregation Pipeline
    const match = {};
    if (dept) match.department = dept;

    if (min !== null || max !== null) {
      match.priceNum = {};
      if (min !== null && !Number.isNaN(min)) match.priceNum.$gte = min;
      if (max !== null && !Number.isNaN(max)) match.priceNum.$lte = max;
    }

    /* Why Aggregation? 
       We use $addFields to convert the 'price' string to a double ($toDouble)
       so we can perform mathematical comparisons (greater than/less than) 
       which wouldn't work correctly on string data.
    */
    const products = await Product.aggregate([
      { $addFields: { priceNum: { $toDouble: '$price' } } },
      { $match: match },
      { $skip: skip },
      { $limit: pageSize },
    ]);

    // Count total filtered products to calculate total pages for the UI
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
  } catch (err) {
    // Task 5: Meaningful Debugging
    console.error('Error in Shop Main Route:', err);
    res
      .status(500)
      .send('Internal Server Error: Unable to load products at this time.');
  }
});

module.exports = router;

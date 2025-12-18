var express = require('express');
var router = express.Router();
var Product = require('../../models/Product');

router.get('/product/:id', async function (req, res) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      req.flash('danger', 'Product not found');
      return res.redirect('/');
    }

    return res.render('site/product-detail', {
      pagetitle: product.name,
      product,
    });
  } catch (err) {
    req.flash('danger', 'Invalid product id');
    return res.redirect('/');
  }
});

module.exports = router;

var express = require('express');
var router = express.Router();
var Product = require('../../../models/Product');

router.get('/', async function (req, res) {
  let products = await Product.find();
  return res.send(products);
});

module.exports = router;

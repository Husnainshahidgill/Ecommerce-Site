var express = require('express');
var router = express.Router();
var Product = require('../../models/Product');

const multer = require('multer');

// ✅ Only admin/superadmin can modify products
function requireAdmin(req, res, next) {
  const roles = req.user?.roles || [];
  const isAdmin = roles.includes('admin') || roles.includes('superadmin');
  if (!isAdmin) return res.status(403).send('Forbidden');
  next();
}

const storage = multer.diskStorage({
  destination: (req, file, callBack) => {
    callBack(null, 'public/images/uploaded');
  },
  filename: (req, file, callBack) => {
    callBack(null, `${Date.now()}-${file.originalname.split(' ').join('-')}`);
  },
});

// ✅ (Optional but recommended) Only images + 2MB limit
let upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(null, false);
    cb(null, true);
  },
});

// GET all products (any authenticated user can read)
router.get('/', async function (req, res) {
  let products = await Product.find();
  return res.send(products);
});

// GET one product
router.get('/:id', async function (req, res) {
  try {
    let product = await Product.findById(req.params.id);
    if (!product) return res.status(404).send('Product not found');
    return res.send(product);
  } catch (err) {
    return res.status(400).send('Invalid Id');
  }
});

// CREATE product (admin only)
router.post(
  '/',
  requireAdmin,
  upload.single('image'),
  async function (req, res) {
    let product = new Product(req.body);

    if (req.file && req.file.filename) {
      product.image = req.file.filename;
    }

    await product.save();
    return res.send(product);
  }
);

// UPDATE product (admin only)
router.put('/:id', requireAdmin, async function (req, res) {
  try {
    let product = await Product.findById(req.params.id);
    if (!product) return res.status(404).send('Product not found');

    product.name = req.body.name;
    product.price = req.body.price;
    product.color = req.body.color;
    product.description = req.body.description;
    product.department = req.body.department;

    await product.save();
    return res.send(product);
  } catch (err) {
    return res.status(400).send('Invalid Id');
  }
});

// DELETE product (admin only)
router.delete('/:id', requireAdmin, async function (req, res) {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).send('Product not found');
    return res.send('deleted');
  } catch (err) {
    return res.status(400).send('Invalid Id');
  }
});

module.exports = router;

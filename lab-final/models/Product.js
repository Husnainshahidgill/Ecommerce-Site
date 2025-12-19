const mongoose = require('mongoose');
const productSchema = mongoose.Schema({
  name: String,
  price: { type: Number, required: true, min: 0 },
  color: String,
  department: String,
  description: String,
  image: String,
  quantity: { type: Number, default: 0 },
});
const Product = mongoose.model('Product', productSchema);
module.exports = Product;

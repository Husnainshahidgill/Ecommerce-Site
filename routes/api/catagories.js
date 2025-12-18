var express = require('express');
var router = express.Router();
var Category = require('../../models/Category');

// GET all
router.get('/', async function (req, res) {
  let categories = await Category.find();
  return res.send(categories);
});

// GET one
router.get('/:id', async function (req, res) {
  try {
    let category = await Category.findById(req.params.id);
    if (!category) return res.status(404).send('Category not found');
    return res.send(category);
  } catch (err) {
    return res.status(400).send('Invalid Id');
  }
});

// UPDATE
router.put('/:id', async function (req, res) {
  try {
    let category = await Category.findById(req.params.id);
    if (!category) return res.status(404).send('Category not found');

    category.name = req.body.name;
    category.description = req.body.description;
    category.slug = req.body.slug ?? category.slug;

    await category.save();
    return res.send(category);
  } catch (err) {
    return res.status(400).send('Invalid Id');
  }
});

// DELETE
router.delete('/:id', async function (req, res) {
  try {
    const deleted = await Category.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).send('Category not found');
    return res.send('deleted');
  } catch (err) {
    return res.status(400).send('Invalid Id');
  }
});

module.exports = router;

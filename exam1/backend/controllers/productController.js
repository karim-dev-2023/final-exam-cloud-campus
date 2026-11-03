const Product = require('../models/Product');
exports.getProducts = async (req, res, next) => {
  try { return res.json(await Product.find()); } catch (error) { return next(error); }
};
exports.updateProductStock = async (req, res, next) => {
  const { stock } = req.body || {};
  const { productId } = req.params;
  const numericStock = typeof stock === 'string' && /^\d+$/.test(stock) ? Number(stock) : stock;
  if (!/^[a-f\d]{24}$/i.test(productId) || !Number.isSafeInteger(numericStock) || numericStock < 0) {
    return res.status(400).json({ message: 'Identifiant ou stock invalide.' });
  }
  try {
    const product = await Product.findByIdAndUpdate(productId, { $set: { stock: numericStock } }, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ message: 'Produit non trouvé.' });
    return res.json({ message: 'Stock mis à jour.', product });
  } catch (error) { return next(error); }
};

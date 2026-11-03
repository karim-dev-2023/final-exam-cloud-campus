const orders = require('./orderController');
const products = require('./productController');
exports.getOrders = orders.getOrders;
exports.updateOrderStatus = orders.updateOrderStatus;
exports.validateOrder = orders.validateOrder;
exports.getProducts = products.getProducts;
exports.updateProductStock = (req, res, next) => { req.params.productId = req.params.id; return products.updateProductStock(req, res, next); };

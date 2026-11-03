import axios from 'axios';
import { API_BASE_URL } from './apiConfig';
import { fetchProducts, createOrder } from './api';
import { getOrders, getProducts, updateOrderStatus, validateOrder, deleteOrder, updateProductStock } from './adminApi';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('token', 'synthetic-session');
});

test('catalogue uses the configured public endpoint', () => {
  fetchProducts();
  expect(axios.get).toHaveBeenCalledWith(`${API_BASE_URL}/products`);
});

test('checkout preserves the payload, JWT and idempotency key', () => {
  const order = { items: [{ productId: 'product', quantity: 2 }], shippingMethod: 'colissimo', paymentMethod: 'PayPal' };
  createOrder(order, 'synthetic-checkout');
  expect(axios.post).toHaveBeenCalledWith(`${API_BASE_URL}/orders`, order, {
    headers: { Authorization: 'Bearer synthetic-session', 'Idempotency-Key': 'synthetic-checkout' },
  });
});

test('JWT is read at request time after a session change', () => {
  localStorage.setItem('token', 'replacement-session');
  createOrder({ items: [] });
  expect(axios.post).toHaveBeenCalledWith(`${API_BASE_URL}/orders`, { items: [] }, {
    headers: { Authorization: 'Bearer replacement-session' },
  });
});

test.each([
  ['orders', getOrders, 'get', '/orders', undefined],
  ['products', getProducts, 'get', '/products', undefined],
  ['status', () => updateOrderStatus('order', 'Expédiée'), 'put', '/orders/order/status', { status: 'Expédiée' }],
  ['validation', () => validateOrder('order'), 'put', '/orders/order/validate', {}],
  ['deletion', () => deleteOrder('order'), 'delete', '/orders/order', undefined],
  ['stock', () => updateProductStock('product', 3), 'put', '/products/product/stock', { stock: 3 }],
])('admin %s uses the configured backend with JWT', (_name, request, method, path, body) => {
  request();
  const config = { headers: { Authorization: 'Bearer synthetic-session' } };
  const args = body === undefined ? [config] : [body, config];
  expect(axios[method]).toHaveBeenCalledWith(`${API_BASE_URL}${path}`, ...args);
});

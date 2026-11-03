const React = require('../frontend/node_modules/react');
const { render, screen, fireEvent, waitFor, cleanup, act } = require('../frontend/node_modules/@testing-library/react');
const { MemoryRouter } = require('../frontend/node_modules/react-router-dom');
const { CartProvider, useCart, cartReducer } = require('../frontend/src/context/CartContext');
const Register = require('../frontend/src/pages/Register').default;
const Order = require('../frontend/src/pages/Order').default;
const { createOrder } = require('../frontend/src/services/api');
jest.mock('../frontend/src/services/api', () => ({ createOrder: jest.fn() }));
beforeEach(() => {
  jest.clearAllMocks(); window.alert = jest.fn();
  Object.defineProperty(window, 'crypto', { configurable: true, value: { randomUUID: () => 'synthetic-request-key-0001' } });
});
afterEach(cleanup);
test('P1-02 UI: cart reducer preserves previous state and never exceeds available stock', () => {
  const item = Object.freeze({ id: 'test', stock: 2, quantity: 1 });
  const previous = Object.freeze({ cart: Object.freeze([item]) });
  const next = cartReducer(previous, { type: 'ADD_TO_CART', payload: { id: 'test', quantity: 100 } });
  expect(previous.cart[0].quantity).toBe(1); expect(next.cart[0].quantity).toBe(2);
  expect(next.cart[0]).not.toBe(previous.cart[0]);
});
test('P1-02 UI: out-of-stock and fractional quantities cannot enter the cart', () => {
  const state = { cart: [] };
  expect(cartReducer(state, { type: 'ADD_TO_CART', payload: { id: 'test', stock: 0, quantity: 1 } })).toBe(state);
  expect(cartReducer(state, { type: 'ADD_TO_CART', payload: { id: 'test', stock: 3, quantity: 1.5 } })).toBe(state);
});
function CheckoutHarness() {
  const { dispatch } = useCart();
  React.useEffect(() => {
    dispatch({ type: 'ADD_TO_CART', payload: { id: 'synthetic', name: 'Fictif', price: 20, stock: 3, quantity: 1 } });
    dispatch({ type: 'SET_SHIPPING_ADDRESS', payload: { street: 'Test', city: 'Test', postalCode: '00000', country: 'Test' } });
    dispatch({ type: 'SET_PAYMENT_METHOD', payload: 'Carte bancaire' });
    dispatch({ type: 'SET_SHIPPING_METHOD', payload: 'colissimo' });
  }, [dispatch]);
  return React.createElement(Order);
}
test('P1-02 UI: double click submits one checkout with an idempotency key', async () => {
  let complete;
  createOrder.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  render(React.createElement(MemoryRouter, null, React.createElement(CartProvider, null, React.createElement(CheckoutHarness))));
  const button = await screen.findByText('Confirmer la commande');
  fireEvent.click(button); fireEvent.click(button);
  expect(createOrder).toHaveBeenCalledTimes(1);
  expect(createOrder.mock.calls[0][1]).toBe('synthetic-request-key-0001');
  expect(button.disabled).toBe(true);
  await act(async () => { complete({ data: { order: {} } }); });
  await waitFor(() => expect(screen.getByText('Votre panier est vide.')).toBeTruthy());
});
test('P1-07 UI: required fields and password constraints reject an empty registration form', () => {
  const { container } = render(React.createElement(MemoryRouter, null, React.createElement(Register)));
  const form = container.querySelector('form');
  expect(form.checkValidity()).toBe(false);
  fireEvent.change(screen.getByPlaceholderText("Nom d'utilisateur"), { target: { value: 'valid_user' } });
  fireEvent.change(screen.getByPlaceholderText('Adresse email'), { target: { value: 'valid@example.fr' } });
  fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: 'short' } });
  expect(form.checkValidity()).toBe(false);
  fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: 'Synthetic-password-2026' } });
  expect(form.checkValidity()).toBe(true);
});
test('P1-02 UI: retries keep their key until a definitive failure permits a new checkout', async () => {
  window.crypto.randomUUID = jest.fn().mockReturnValueOnce('synthetic-request-key-0001').mockReturnValueOnce('synthetic-request-key-0002');
  createOrder.mockReset().mockRejectedValueOnce(new Error('Synthetic network failure'))
    .mockRejectedValueOnce({ response: { status: 409, data: { checkoutState: 'failed', message: 'Stock insuffisant.' } } })
    .mockResolvedValueOnce({ data: { order: {} } });
  render(React.createElement(MemoryRouter, null, React.createElement(CartProvider, null, React.createElement(CheckoutHarness))));
  const button = await screen.findByText('Confirmer la commande');
  fireEvent.click(button);
  await waitFor(() => expect(button.disabled).toBe(false));
  fireEvent.click(button);
  await waitFor(() => expect(button.disabled).toBe(false));
  fireEvent.click(button);
  await waitFor(() => expect(screen.getByText('Votre panier est vide.')).toBeTruthy());
  expect(createOrder.mock.calls.map(call => call[1])).toEqual([
    'synthetic-request-key-0001', 'synthetic-request-key-0001', 'synthetic-request-key-0002',
  ]);
});

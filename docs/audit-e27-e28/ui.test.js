// Tests documenting current behavior. Isolated CLI configuration, no project edits.
const React = require('../../exam1/frontend/node_modules/react');
const { render, screen, cleanup } = require('../../exam1/frontend/node_modules/@testing-library/react');
const { MemoryRouter } = require('../../exam1/frontend/node_modules/react-router-dom');
const { CartProvider, useCart, cartReducer } = require('../../exam1/frontend/src/context/CartContext');
const Shipping = require('../../exam1/frontend/src/components/ShippingMethodSelection').default;
const Payment = require('../../exam1/frontend/src/components/handlePaymentChange').default;
const Register = require('../../exam1/frontend/src/pages/Register').default;
const AdminRoute = require('../../exam1/frontend/src/components/AdminRoute').default;
afterEach(() => { cleanup(); localStorage.clear(); });
function StateProbe() {
  const { shippingMethod, paymentMethod } = useCart();
  return React.createElement('output', { 'data-testid': 'state' }, JSON.stringify({ shippingMethod, paymentMethod }));
}
test('Observed: selects display first choices while context methods remain null', () => {
  render(React.createElement(CartProvider, null,
    React.createElement(Shipping), React.createElement(Payment), React.createElement(StateProbe)));
  expect(screen.getAllByRole('combobox').map(x => x.value)).toEqual(['colissimo', 'Carte bancaire']);
  expect(JSON.parse(screen.getByTestId('state').textContent)).toEqual({ shippingMethod: null, paymentMethod: null });
});
test('Observed: empty registration inputs satisfy browser required-field validation', () => {
  const { container } = render(React.createElement(MemoryRouter, null, React.createElement(Register)));
  const inputs = [...container.querySelectorAll('input')];
  expect(inputs).toHaveLength(3);
  expect(inputs.every(x => x.value === '' && x.required === false && x.checkValidity())).toBe(true);
});
test('Observed: localStorage role forgery opens UI; this does not prove backend access', () => {
  localStorage.setItem('token', 'synthetic-placeholder'); localStorage.setItem('role', 'admin');
  render(React.createElement(MemoryRouter, null,
    React.createElement(AdminRoute, null, React.createElement('span', null, 'AUDIT ADMIN UI'))));
  expect(screen.getByText('AUDIT ADMIN UI')).toBeTruthy();
});
test('Observed: adding an existing product mutates previous state and exceeds stock', () => {
  const previous = { cart: [{ id: 'synthetic', quantity: 1, stock: 1 }] };
  const next = cartReducer(previous, { type: 'ADD_TO_CART', payload: { id: 'synthetic', quantity: 1 } });
  expect(previous.cart[0].quantity).toBe(2);
  expect(next.cart[0].quantity).toBeGreaterThan(next.cart[0].stock);
});

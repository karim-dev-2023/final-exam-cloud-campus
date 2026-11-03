const React = require('../frontend/node_modules/react');
const { render, screen, fireEvent, waitFor, cleanup } = require('../frontend/node_modules/@testing-library/react');
const { MemoryRouter } = require('../frontend/node_modules/react-router-dom');
const axios = require('../frontend/node_modules/axios/dist/node/axios.cjs');
const { CartProvider } = require('../frontend/src/context/CartContext');
const Products = require('../frontend/src/pages/ProductList').default;
const Cart = require('../frontend/src/pages/Cart').default;
const Register = require('../frontend/src/pages/Register').default;
const Login = require('../frontend/src/pages/Login').default;
jest.mock('../frontend/node_modules/axios/dist/node/axios.cjs', () => ({ get: jest.fn(), post: jest.fn() }));
beforeEach(() => { jest.clearAllMocks(); window.alert = jest.fn(); localStorage.clear(); });
afterEach(cleanup);
function wrap(children) {
  return React.createElement(MemoryRouter, null, React.createElement(CartProvider, null, children));
}
test('Non-regression: products load and an article can be added to the real cart', async () => {
  axios.get.mockResolvedValue({ data: [{ _id: 'synthetic-product', name: 'Produit factice', price: 20, stock: 3 }] });
  render(wrap(React.createElement(React.Fragment, null, React.createElement(Products), React.createElement(Cart))));
  fireEvent.click(await screen.findByText('Ajouter au panier'));
  expect(screen.getByRole('spinbutton').value).toBe('1');
  expect(screen.getAllByText('Produit factice')).toHaveLength(2);
  fireEvent.click(screen.getByText('+'));
  expect(screen.getByRole('spinbutton').value).toBe('2');
  fireEvent.click(screen.getByText('-'));
  expect(screen.getByRole('spinbutton').value).toBe('1');
  fireEvent.click(screen.getByText('Retirer'));
  expect(screen.getByText('Votre panier est vide')).toBeTruthy();
});
test('Non-regression: valid registration submits the original HTTP contract', async () => {
  axios.post.mockResolvedValue({ status: 201, data: {} });
  const { container } = render(wrap(React.createElement(Register)));
  fireEvent.change(screen.getByPlaceholderText("Nom d'utilisateur"), { target: { value: 'test_user' } });
  fireEvent.change(screen.getByPlaceholderText('Adresse email'), { target: { value: 'test@example.invalid' } });
  fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: 'Synthetic-password-2026' } });
  fireEvent.submit(container.querySelector('form'));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith('http://localhost:5000/api/auth/register', {
    username: 'test_user', email: 'test@example.invalid', password: 'Synthetic-password-2026',
  }));
});
test('Non-regression: login stores the returned user identity', async () => {
  axios.post.mockResolvedValue({ data: { token: 'synthetic-user-token', role: 'user', username: 'test_user' } });
  const { container } = render(wrap(React.createElement(Login)));
  fireEvent.change(screen.getByPlaceholderText("Nom d'utilisateur"), { target: { value: 'test_user' } });
  fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: 'Synthetic-password-2026' } });
  fireEvent.submit(container.querySelector('form'));
  await waitFor(() => expect(localStorage.getItem('token')).toBe('synthetic-user-token'));
  expect(localStorage.getItem('role')).toBe('user');
});

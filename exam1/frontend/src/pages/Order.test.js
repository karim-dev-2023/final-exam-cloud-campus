import React, { useEffect } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import { CartProvider, useCart } from '../context/CartContext';
import { API_BASE_URL } from '../services/apiConfig';
import Order from './Order';

jest.mock('axios', () => ({ post: jest.fn() }));

const address = { street: '1 rue du Test', postalCode: '75001', city: 'Paris', country: 'France' };
const originalCrypto = window.crypto;

beforeAll(() => {
  Object.defineProperty(window, 'crypto', { configurable: true, value: { randomUUID: () => 'synthetic-checkout-key' } });
});
afterAll(() => {
  Object.defineProperty(window, 'crypto', { configurable: true, value: originalCrypto });
});

function Checkout() {
  const { dispatch } = useCart();
  useEffect(() => {
    dispatch({ type: 'ADD_TO_CART', payload: { id: 'product', name: 'Produit test', price: 20, stock: 2, quantity: 2 } });
    dispatch({ type: 'SET_SHIPPING_ADDRESS', payload: address });
  }, [dispatch]);
  return <Order />;
}

beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
  localStorage.setItem('token', 'synthetic-checkout-session');
  window.alert = jest.fn();
});

function renderCheckout() {
  render(<MemoryRouter><CartProvider><Checkout /></CartProvider></MemoryRouter>);
}

test('checkout sends the cart and delivery data to the backend, then clears the cart', async () => {
  axios.post.mockResolvedValue({ data: { order: { _id: 'order' } } });
  renderCheckout();
  fireEvent.click(screen.getByText('Confirmer la commande'));
  await screen.findByText('Votre panier est vide.');
  expect(axios.post).toHaveBeenCalledWith(`${API_BASE_URL}/orders`, {
    items: [{ productId: 'product', quantity: 2, price: 20 }], total: 40,
    shippingAddress: address, shippingMethod: 'colissimo', paymentMethod: 'Carte bancaire',
  }, { headers: { Authorization: 'Bearer synthetic-checkout-session', 'Idempotency-Key': expect.any(String) } });
});

test('a network failure keeps the cart and reuses the idempotency key on retry', async () => {
  axios.post.mockRejectedValue(new Error('synthetic-network-failure'));
  renderCheckout();
  fireEvent.click(screen.getByText('Confirmer la commande'));
  await waitFor(() => expect(window.alert).toHaveBeenCalledTimes(1));
  expect(screen.getByText('Produit test')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Confirmer la commande'));
  await waitFor(() => expect(window.alert).toHaveBeenCalledTimes(2));
  const firstHeaders = axios.post.mock.calls[0][2].headers;
  expect(axios.post.mock.calls[1][2].headers).toEqual(firstHeaders);
  expect(screen.queryByText('Votre panier est vide.')).not.toBeInTheDocument();
});

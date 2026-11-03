import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import App from './App';
import { CartProvider, useCart } from './context/CartContext';
import AdminRoute from './components/AdminRoute';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Register from './pages/Register';
import Shipping from './components/ShippingMethodSelection';
import Payment from './components/handlePaymentChange';
import { API_BASE_URL } from './services/apiConfig';
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() }));
beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); window.alert = jest.fn(); });
const wrap = child => <MemoryRouter><CartProvider>{child}</CartProvider></MemoryRouter>;
test('application loads its catalogue using the real route and provider', async () => {
  axios.get.mockResolvedValue({ data: [{_id:'product',name:'Produit factice',price:20,stock:2}] });
  render(<CartProvider><App /></CartProvider>);
  expect(await screen.findByText('Produit factice')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Ajouter au panier'));
  expect(screen.getByText('Liste des Produits')).toBeInTheDocument();
});
function Methods() {const state=useCart();return <output>{state.shippingMethod + ' / ' + state.paymentMethod}</output>;}
test('delivery and payment defaults match context; other options remain selectable', () => {
  render(wrap(<><Shipping/><Payment/><Methods/></>));
  expect(screen.getByText('colissimo / Carte bancaire')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Méthode de livraison:'),{target:{value:'chronopost'}});
  fireEvent.change(screen.getByLabelText('Mode de paiement:'),{target:{value:'PayPal'}});
  expect(screen.getByText('chronopost / PayPal')).toBeInTheDocument();
});
test('empty login and registration forms fail browser validation', () => {
  const {unmount}=render(wrap(<Login/>));
  expect(screen.getByRole('form', {name:'Connexion'}).checkValidity()).toBe(false);unmount();
  render(wrap(<Register/>));
  expect(screen.getByRole('form', {name:'Inscription'}).checkValidity()).toBe(false);
  expect(axios.post).not.toHaveBeenCalled();
});
test('login failure shows a public message without storing identity', async () => {
  axios.post.mockRejectedValue({response:{data:{message:'Identifiants incorrects.'}}});
  render(wrap(<Login/>));
  fireEvent.change(screen.getByPlaceholderText("Nom d'utilisateur"),{target:{value:'test_user'}});
  fireEvent.change(screen.getByPlaceholderText('Mot de passe'),{target:{value:'Synthetic-password-2026'}});
  fireEvent.submit(screen.getByRole('form', {name:'Connexion'}));
  await waitFor(()=>expect(window.alert).toHaveBeenCalledWith('Identifiants incorrects.'));
  expect(localStorage.getItem('token')).toBeNull();
});
test('forged local admin role never reveals admin children after server rejection', async () => {
  localStorage.setItem('token','fake');localStorage.setItem('role','admin');
  axios.get.mockRejectedValue({response:{status:403}});
  render(wrap(<AdminRoute><p>Données privées</p></AdminRoute>));
  expect(screen.queryByText('Données privées')).not.toBeInTheDocument();
  await waitFor(()=>expect(screen.queryByRole('status')).not.toBeInTheDocument());
  expect(screen.queryByText('Données privées')).not.toBeInTheDocument();
});
test('server confirmed admin can access the interface', async () => {
  localStorage.setItem('token','synthetic');axios.get.mockResolvedValue({data:{role:'admin'}});
  render(wrap(<AdminRoute><p>Données privées</p></AdminRoute>));
  expect(await screen.findByText('Données privées')).toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith(`${API_BASE_URL}/auth/me`, { headers: { Authorization: 'Bearer synthetic' } });
});

test('successful login uses the configured backend and preserves session identity', async () => {
  axios.post.mockResolvedValue({data:{token:'synthetic-session',role:'client',username:'test_user'}});
  render(wrap(<Login/>));
  fireEvent.change(screen.getByPlaceholderText("Nom d'utilisateur"),{target:{value:'test_user'}});
  fireEvent.change(screen.getByPlaceholderText('Mot de passe'),{target:{value:'Synthetic-password-2026'}});
  fireEvent.submit(screen.getByRole('form', {name:'Connexion'}));
  await waitFor(()=>expect(localStorage.getItem('token')).toBe('synthetic-session'));
  expect(localStorage.getItem('role')).toBe('client');
  expect(localStorage.getItem('username')).toBe('test_user');
  expect(axios.post).toHaveBeenCalledWith(`${API_BASE_URL}/auth/login`, {username:'test_user',password:'Synthetic-password-2026'});
});

test('registration uses the configured backend without sending a privileged role', async () => {
  axios.post.mockResolvedValue({data:{}});
  render(wrap(<Register/>));
  fireEvent.change(screen.getByPlaceholderText("Nom d'utilisateur"),{target:{value:'test_user'}});
  fireEvent.change(screen.getByPlaceholderText('Adresse email'),{target:{value:'test@example.com'}});
  fireEvent.change(screen.getByPlaceholderText('Mot de passe'),{target:{value:'Synthetic-password-2026'}});
  fireEvent.submit(screen.getByRole('form', {name:'Inscription'}));
  await waitFor(()=>expect(window.alert).toHaveBeenCalled());
  expect(axios.post).toHaveBeenCalledWith(`${API_BASE_URL}/auth/register`, {username:'test_user',email:'test@example.com',password:'Synthetic-password-2026'});
});
test('admin validation and terminal deletion follow the server result', async () => {
  axios.get.mockImplementation(url=>Promise.resolve({data:url.endsWith('/orders')?[{_id:'order',status:'En attente',items:[]}]:[]}));
  axios.put.mockResolvedValue({data:{order:{_id:'order',status:'Annulée',items:[]}}});
  axios.delete.mockResolvedValue({status:204});
  render(wrap(<Admin/>));
  fireEvent.click(await screen.findByText('Valider la commande'));
  await waitFor(()=>expect(axios.put).toHaveBeenCalledWith(expect.stringContaining('/order/status'),{status:'En cours de traitement'},expect.any(Object)));
  fireEvent.click(await screen.findByText('Supprimer'));
  await waitFor(()=>expect(screen.queryByText('Supprimer')).not.toBeInTheDocument());
  expect(axios.delete).toHaveBeenCalled();
});
test('admin loading failures are handled visibly', async () => {
  axios.get.mockRejectedValue(new Error('synthetic'));
  render(wrap(<Admin/>));expect(await screen.findByRole('alert')).toHaveTextContent('Chargement impossible');
});

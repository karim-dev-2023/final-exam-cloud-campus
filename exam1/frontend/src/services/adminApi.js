import axios from 'axios';
import { API_BASE_URL as base } from './apiConfig';
const config = () => ({ headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
export const getOrders = () => axios.get(base + '/orders', config());
export const getProducts = () => axios.get(base + '/products', config());
export const updateOrderStatus = (id, status) => axios.put(base + '/orders/' + id + '/status', { status }, config());
export const validateOrder = id => axios.put(base + '/orders/' + id + '/validate', {}, config());
export const deleteOrder = id => axios.delete(base + '/orders/' + id, config());
export const updateProductStock = (id, stock) => axios.put(base + '/products/' + id + '/stock', { stock }, config());

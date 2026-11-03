// src/services/api.js
import axios from 'axios';

import { API_BASE_URL } from './apiConfig';

export const fetchProducts = () => axios.get(`${API_BASE_URL}/products`);

export const createOrder = (orderData, idempotencyKey) => {
    const token = localStorage.getItem('token'); // Token de connexion
    return axios.post(`${API_BASE_URL}/orders`, orderData, {
        headers: {
            Authorization: `Bearer ${token}`,
            ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
    });
};

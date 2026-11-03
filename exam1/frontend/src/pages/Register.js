// src/pages/Register.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../services/apiConfig';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await axios.post(`${API_BASE_URL}/auth/register`, formData);
      alert('Inscription réussie ! Vous pouvez maintenant vous connecter.');
      navigate('/login');
    } catch (err) {
      //console.error('La requête a échoué.');
      if (err.response) {
        // Erreur renvoyée par le serveur
        const { message } = err.response.data;
        setError(message);
        alert(message); // Affiche un message à l'utilisateur (vous pouvez remplacer par un toast)
      } else {
        // Erreur réseau ou autre
        console.error('La requête a échoué.');
        alert("Une erreur est survenue. Veuillez réessayer.");
      }
      //setError('Une erreur est survenue lors de la création du compte.');
    }
  };

  return (
    <div className="flex justify-center items-center h-screen">
      <form aria-label="Inscription" onSubmit={handleSubmit} className="bg-white p-6 rounded shadow-md w-80">
        <h2 className="text-2xl font-bold mb-4 text-center">Inscription</h2>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <input
          type="text"
          name="username"
          required
          minLength={3}
          maxLength={50}
          placeholder="Nom d'utilisateur"
          value={formData.username}
          onChange={handleChange}
          className="border border-gray-300 p-2 w-full mb-4"
        />
        <input
          type="email"
          name="email"
          required
          maxLength={254}
          placeholder="Adresse email"
          value={formData.email}
          onChange={handleChange}
          className="border border-gray-300 p-2 w-full mb-4"
        />
        <input
          type="password"
          name="password"
          required
          minLength={12}
          maxLength={72}
          pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{12,72}"
          title="12 caractères minimum, avec majuscule, minuscule et chiffre ; 72 octets maximum."
          placeholder="Mot de passe"
          value={formData.password}
          onChange={handleChange}
          className="border border-gray-300 p-2 w-full mb-4"
        />
        <button type="submit" className="bg-blue-500 text-white p-2 w-full rounded">S'inscrire</button>
      </form>
    </div>
  );
};

export default Register;

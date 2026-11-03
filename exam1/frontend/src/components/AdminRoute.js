import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
const AdminRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const [identity, setIdentity] = useState(null);
  useEffect(() => {
    let active = true;
    if (token) axios.get('http://localhost:5000/api/auth/me', { headers: { Authorization: 'Bearer ' + token } })
      .then(({ data }) => { if (active) setIdentity({ token, role: data.role }); })
      .catch(() => { if (active) setIdentity({ token, role: null }); });
    return () => { active = false; };
  }, [token]);
  if (!token) return <Navigate to="/" replace />;
  if (identity?.token !== token) return <p role="status">Vérification de la session…</p>;
  return identity.role === 'admin' ? children : <Navigate to="/" replace />;
};
export default AdminRoute;

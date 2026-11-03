import React, { useState, useEffect } from 'react';
import { getOrders, getProducts, updateOrderStatus, updateProductStock, deleteOrder } from '../services/adminApi';
const transitions = { 'En attente': ['En cours de traitement', 'Annulée'], 'En cours de traitement': ['Expédiée', 'Annulée'], 'Expédiée': ['Délivrée'], 'Délivrée': [], 'Annulée': [] };
export default function Admin() {
  const [orders, setOrders] = useState([]), [products, setProducts] = useState([]);
  const [selected, setSelected] = useState(null), [busy, setBusy] = useState(null);
  const [stocks, setStocks] = useState({}), [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([getOrders(), getProducts()]).then(([o,p]) => {
      if (active) { setOrders(o.data); setProducts(p.data); }
    }).catch(() => { if (active) setError('Chargement impossible. Vérifiez votre session et réessayez.'); });
    return () => { active = false; };
  }, []);
  async function change(id, status) {
    setBusy(id); setError('');
    try {
      const {data} = await updateOrderStatus(id,status);
      setOrders(previous => previous.map(o => o._id === id ? data.order : o));
      setSelected(previous => previous?._id === id ? data.order : previous);
    } catch { setError('Modification impossible. Rechargez la liste et réessayez.'); }
    finally { setBusy(null); }
  }
  async function remove(id) {
    setBusy(id); setError('');
    try { await deleteOrder(id); setOrders(previous => previous.filter(o => o._id !== id)); setSelected(null); }
    catch { setError('Suppression impossible. Rechargez la liste et réessayez.'); }
    finally { setBusy(null); }
  }
  async function stock(id) {
    const value=stocks[id];
    if (value === undefined || value === '' || !Number.isSafeInteger(Number(value)) || Number(value)<0) {
      setError('Le stock doit être un entier positif ou nul.'); return;
    }
    setBusy(id); setError('');
    try {
      const {data}=await updateProductStock(id,Number(value));
      setProducts(previous=>previous.map(p=>p._id===id?data.product:p));
      setStocks(previous=>({...previous,[id]:''}));
    } catch { setError('Mise à jour du stock impossible.'); }
    finally {setBusy(null);}
  }
  return <div className="p-8">
    <h2 className="text-2xl font-bold mb-4">Page d'administration</h2>
    {error && <p role="alert">{error}</p>}
    <h3 className="text-xl font-semibold">Gestion des Commandes</h3>
    <ul>{orders.map(o=><li key={o._id} className="border p-4 mb-4 rounded shadow">
      <p><strong>ID :</strong> {o._id}</p><p><strong>Status :</strong> {o.status}</p>
      {(transitions[o.status] || []).map(status=><button key={status} disabled={busy!==null} onClick={()=>change(o._id,status)} className="bg-blue-500 text-white p-2 m-1 rounded">
        {status==='En cours de traitement'?'Valider la commande':status}
      </button>)}
      {['Délivrée','Annulée'].includes(o.status) && <button disabled={busy!==null} onClick={()=>remove(o._id)}>Supprimer</button>}
      <button onClick={()=>setSelected(o)} className="bg-gray-500 text-white p-2 m-1 rounded">Détails</button>
    </li>)}</ul>
    <h3 className="text-xl font-semibold">Gestion des Produits</h3>
    <table className="min-w-full border"><thead><tr><th>Nom</th><th>Prix</th><th>Stock</th><th>Actions</th></tr></thead>
      <tbody>{products.map(p=><tr key={p._id}>
        <td>{p.name}</td><td>{p.price} €</td><td>{p.stock}</td><td>
          <input aria-label={'Nouveau stock '+p.name} type="number" min="0" step="1" placeholder="Nouveau stock" value={stocks[p._id]??''} onChange={e=>setStocks({...stocks,[p._id]:e.target.value})}/>
          <button disabled={busy!==null} onClick={()=>stock(p._id)}>Mettre à jour</button>
        </td>
      </tr>)}</tbody></table>
    {selected && <div role="dialog" aria-label="Détails de la commande" className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
      <div className="bg-white p-6 rounded-lg"><h2>Détails de la Commande</h2><p>ID : {selected._id}</p><p>Status : {selected.status}</p><p>Total : {selected.total} €</p>
        <ul>{selected.items.map((item,index)=><li key={index}>Produit ID : {item.productId}, Quantité : {item.quantity}, Prix : {item.price} €</li>)}</ul>
        <button onClick={()=>setSelected(null)}>Fermer</button>
      </div>
    </div>}
  </div>;
}

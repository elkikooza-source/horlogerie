import React, { useEffect, useState, useCallback } from 'react';
import { Search, Eye, X } from 'lucide-react';
import { Order, OrderStatus } from '../../types';
import { useStore } from '../../context/StoreContext';

interface AdminOrdersProps {
  token: string;
}

const STATUS_LABELS: Record<OrderStatus, { label: string; style: string }> = {
  en_attente: { label: 'En attente', style: 'bg-amber-50 text-amber-800 border-amber-200' },
  confirmee: { label: 'Confirmée', style: 'bg-blue-50 text-blue-800 border-blue-200' },
  expediee: { label: 'Expédiée', style: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  livree: { label: 'Livrée', style: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  annulee: { label: 'Annulée', style: 'bg-red-50 text-red-800 border-red-200' },
};

export function AdminOrders({ token }: AdminOrdersProps) {
  const { formatPrice, showToast } = useStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (statusFilter !== 'all') qs.set('status', statusFilter);
      if (search.trim()) qs.set('search', search.trim());
      const res = await fetch(`/api/admin/orders?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setOrders(await res.json());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, search]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleStatusChange = async (orderId: number, status: OrderStatus) => {
    const res = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      if (selectedOrder?.id === orderId) setSelectedOrder(updated);
      showToast(`Statut mis à jour : ${STATUS_LABELS[status].label}`, 'success');
    } else {
      showToast('Erreur lors du changement de statut.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white border border-neutral-200 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'Toutes' },
            { id: 'en_attente', label: 'En attente' },
            { id: 'confirmee', label: 'Confirmées' },
            { id: 'expediee', label: 'Expédiées' },
            { id: 'livree', label: 'Livrées' },
            { id: 'annulee', label: 'Annulées' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-2 min-h-[40px] text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-[#0B0B0C] text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="N° commande, client, téléphone..."
            className="w-full pl-9 pr-3 py-2 min-h-[44px] bg-neutral-50 border border-neutral-200 text-base sm:text-sm focus:outline-none focus:border-neutral-900"
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-neutral-200 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-600">
              <th className="py-3 px-4">N° Commande</th>
              <th className="py-3 px-4">Client</th>
              <th className="py-3 px-4">Adresse</th>
              <th className="py-3 px-4">Articles</th>
              <th className="py-3 px-4 text-right">Montant</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Statut</th>
              <th className="py-3 px-4 text-right">Détails</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 text-sm">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-xs text-neutral-500">
                  Chargement des commandes...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-xs text-neutral-500">
                  Aucune commande enregistrée pour ce filtre.
                </td>
              </tr>
            ) : (
              orders.map((o) => {
                const st = STATUS_LABELS[o.status] || STATUS_LABELS.en_attente;
                return (
                  <tr key={o.id} className="hover:bg-neutral-50/80">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-neutral-900">
                      {o.order_number}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-neutral-900 text-xs">{o.customer_name}</p>
                      <p className="font-mono text-xs text-neutral-500">{o.customer_phone}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-neutral-600 max-w-[200px] truncate">
                      {o.city}, {o.region}
                    </td>
                    <td className="py-3 px-4 text-xs text-neutral-700 tabular-nums">
                      {o.items?.reduce((acc, it) => acc + it.quantity, 0) || 0} article(s)
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs font-semibold">
                      {formatPrice(o.total_amount)}
                    </td>
                    <td className="py-3 px-4 text-xs text-neutral-500 font-mono tabular-nums">
                      {new Date(o.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={o.status}
                        onChange={(e) => handleStatusChange(o.id, e.target.value as OrderStatus)}
                        className={`px-2 py-1 text-xs font-medium border cursor-pointer focus:outline-none ${st.style}`}
                      >
                        <option value="en_attente">En attente</option>
                        <option value="confirmee">Confirmée</option>
                        <option value="expediee">Expédiée</option>
                        <option value="livree">Livrée</option>
                        <option value="annulee">Annulée</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(o)}
                        className="p-1.5 border border-neutral-200 text-neutral-700 hover:border-neutral-900 cursor-pointer"
                        title="Voir les détails"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white border border-neutral-200 w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h3 className="font-serif text-xl font-semibold">
                  Commande {selectedOrder.order_number}
                </h3>
                <p className="text-xs text-neutral-500 font-mono">
                  {new Date(selectedOrder.created_at).toLocaleString('fr-FR')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 text-neutral-500 hover:text-neutral-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm">
              <div className="bg-neutral-50 border border-neutral-200 p-4 space-y-1.5">
                <p className="text-xs font-semibold text-neutral-500">CLIENT & LIVRAISON</p>
                <p className="font-semibold text-neutral-900">{selectedOrder.customer_name}</p>
                <p className="font-mono text-xs text-neutral-700">
                  Tél : {selectedOrder.customer_phone}
                </p>
                {selectedOrder.customer_email && (
                  <p className="text-xs text-neutral-600">{selectedOrder.customer_email}</p>
                )}
                <p className="text-xs text-neutral-700">
                  {selectedOrder.address}, {selectedOrder.city}, {selectedOrder.region}
                </p>
                {selectedOrder.notes && (
                  <p className="text-xs text-neutral-600 italic pt-1">
                    Remarque : {selectedOrder.notes}
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-neutral-500 mb-2">PRODUITS COMMANDÉS</p>
                <div className="border border-neutral-200 divide-y divide-neutral-100">
                  {selectedOrder.items?.map((item) => (
                    <div key={item.id} className="p-3 flex justify-between items-center gap-3">
                      <div>
                        <p className="font-medium text-neutral-900 text-xs">
                          {item.quantity} × {item.product_name}
                        </p>
                        {item.product_reference && (
                          <p className="text-[11px] font-mono text-neutral-500">
                            {item.product_reference}
                          </p>
                        )}
                      </div>
                      <span className="font-mono tabular-nums text-xs font-semibold">
                        {formatPrice(item.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 text-xs pt-2 border-t border-neutral-200">
                <div className="flex justify-between text-neutral-600">
                  <span>Mode de paiement</span>
                  <span className="font-medium text-neutral-900">
                    {selectedOrder.payment_method}
                  </span>
                </div>
                <div className="flex justify-between text-neutral-600">
                  <span>Frais de livraison</span>
                  <span className="font-mono tabular-nums">
                    {selectedOrder.delivery_fee === 0
                      ? 'Offerte'
                      : formatPrice(selectedOrder.delivery_fee)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-neutral-900 pt-1">
                  <span>Montant total</span>
                  <span className="font-mono tabular-nums">
                    {formatPrice(selectedOrder.total_amount)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

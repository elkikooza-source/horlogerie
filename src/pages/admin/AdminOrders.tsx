import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Search, Eye, Trash2, X, AlertTriangle } from 'lucide-react';
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
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<number[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  const selectAllRef = useRef<HTMLInputElement | null>(null);

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
        const data: Order[] = await res.json();
        setOrders(data);
        const visibleSet = new Set(data.map((o) => o.id));
        setSelectedIds((prev) => prev.filter((id) => visibleSet.has(id)));
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

  const allSelected = orders.length > 0 && orders.every((o) => selectedIds.includes(o.id));
  const someSelected = selectedIds.length > 0 && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(orders.map((o) => o.id));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

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

  const handleConfirmDelete = async () => {
    if (!confirmDeleteIds || confirmDeleteIds.length === 0) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/admin/orders/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids: confirmDeleteIds }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Impossible de supprimer la sélection.', 'error');
        return;
      }

      const data = await res.json();
      const deletedSet = new Set(confirmDeleteIds);
      setOrders((prev) => prev.filter((o) => !deletedSet.has(o.id)));
      setSelectedIds((prev) => prev.filter((id) => !deletedSet.has(id)));
      if (selectedOrder && deletedSet.has(selectedOrder.id)) {
        setSelectedOrder(null);
      }
      setConfirmDeleteIds(null);
      const count = Number(data.deletedCount || confirmDeleteIds.length);
      showToast(
        `${count} commande${count > 1 ? 's' : ''} supprimée${count > 1 ? 's' : ''}.`,
        'success'
      );
    } catch {
      showToast('Erreur réseau lors de la suppression.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
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

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-[#0B0B0C] text-[#F7F5F0] border border-[#C5A46D]/40 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs">
            <span className="font-mono font-semibold text-[#C5A46D] tabular-nums">
              {selectedIds.length}
            </span>
            <span>
              commande{selectedIds.length > 1 ? 's' : ''} sélectionnée
              {selectedIds.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-3 py-2 min-h-[40px] text-xs text-white/75 hover:text-white border border-white/15 hover:border-white/35 transition-colors whitespace-nowrap cursor-pointer"
            >
              Tout désélectionner
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteIds(selectedIds)}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Supprimer la sélection</span>
            </button>
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white border border-neutral-200 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-600">
              <th className="py-3 pl-4 pr-2 w-10">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  disabled={orders.length === 0}
                  aria-label="Sélectionner toutes les commandes"
                  className="w-4 h-4 accent-[#0B0B0C] cursor-pointer align-middle"
                />
              </th>
              <th className="py-3 px-4">N° Commande</th>
              <th className="py-3 px-4">Client</th>
              <th className="py-3 px-4">Adresse</th>
              <th className="py-3 px-4">Articles</th>
              <th className="py-3 px-4 text-right">Montant</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Statut</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 text-sm">
            {loading ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-xs text-neutral-500">
                  Chargement des commandes...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-xs text-neutral-500">
                  Aucune commande enregistrée pour ce filtre.
                </td>
              </tr>
            ) : (
              orders.map((o) => {
                const st = STATUS_LABELS[o.status] || STATUS_LABELS.en_attente;
                const isChecked = selectedIds.includes(o.id);
                return (
                  <tr
                    key={o.id}
                    className={`transition-colors ${
                      isChecked ? 'bg-amber-50/50' : 'hover:bg-neutral-50/80'
                    }`}
                  >
                    <td className="py-3 pl-4 pr-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelectOne(o.id)}
                        aria-label={`Sélectionner la commande ${o.order_number}`}
                        className="w-4 h-4 accent-[#0B0B0C] cursor-pointer align-middle"
                      />
                    </td>
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-neutral-900 whitespace-nowrap">
                      {o.order_number}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-neutral-900 text-xs">{o.customer_name}</p>
                      <p className="font-mono text-xs text-neutral-500">{o.customer_phone}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-neutral-600 max-w-[200px] truncate">
                      {o.city}, {o.region}
                    </td>
                    <td className="py-3 px-4 text-xs text-neutral-700 tabular-nums whitespace-nowrap">
                      {o.items?.reduce((acc, it) => acc + it.quantity, 0) || 0} article(s)
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs font-semibold whitespace-nowrap">
                      {formatPrice(o.total_amount)}
                    </td>
                    <td className="py-3 px-4 text-xs text-neutral-500 font-mono tabular-nums whitespace-nowrap">
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
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(o)}
                          className="p-1.5 border border-neutral-200 text-neutral-700 hover:border-neutral-900 cursor-pointer"
                          title="Voir les détails"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteIds([o.id])}
                          className="p-1.5 border border-neutral-200 text-neutral-500 hover:text-red-600 hover:border-red-300 cursor-pointer"
                          title="Supprimer la commande"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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

            <div className="px-6 py-3.5 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteIds([selectedOrder.id])}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Supprimer cette commande</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 min-h-[40px] border border-neutral-300 text-xs font-medium hover:bg-white cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteIds && confirmDeleteIds.length > 0 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white border border-neutral-200 w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-50 text-red-600 border border-red-200 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-semibold text-neutral-900">
                  Confirmer la suppression
                </h3>
                <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                  Êtes-vous sûr de vouloir supprimer définitivement{' '}
                  <strong className="text-neutral-900">
                    {confirmDeleteIds.length === 1
                      ? 'cette commande'
                      : `ces ${confirmDeleteIds.length} commandes`}
                  </strong>
                  {' '} ? Cette action est irréversible.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDeleteIds(null)}
                className="px-4 py-2 min-h-[44px] border border-neutral-300 text-xs font-medium text-neutral-700 hover:bg-neutral-50 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 min-h-[44px] bg-red-600 hover:bg-red-700 text-white text-xs font-medium disabled:opacity-50 cursor-pointer"
              >
                {deleting
                  ? 'Suppression...'
                  : confirmDeleteIds.length === 1
                  ? 'Supprimer la commande'
                  : `Supprimer (${confirmDeleteIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, Upload, Star, X } from 'lucide-react';
import { Category, Product } from '../../types';
import { useStore } from '../../context/StoreContext';
import { ResilientImage } from '../../components/ResilientImage';

interface AdminProductsProps {
  token: string;
}

const EMPTY_FORM = {
  category_id: 1,
  name: '',
  reference: '',
  description: '',
  price: '',
  promo_price: '',
  stock_qty: '5',
  is_active: true,
  is_bestseller: false,
  is_new: true,
  images: [] as string[],
  primary_image: '',
  specs: {
    movement: '',
    case_material: '',
    diameter: '',
    water_resistance: '',
    strap: '',
    warranty: '2 ans Atelier Horlogerie Zeina',
  },
};

export function AdminProducts({ token }: AdminProductsProps) {
  const { formatPrice, showToast, refreshSettings } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newCatName, setNewCatName] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        fetch('/api/admin/products', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/categories'),
      ]);
      if (prodRes.ok) setProducts(await prodRes.json());
      if (catRes.ok) setCategories(await catRes.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      category_id: categories[0]?.id || 1,
    });
    setModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingId(p.id);
    setForm({
      category_id: p.category_id,
      name: p.name,
      reference: p.reference || '',
      description: p.description || '',
      price: String(p.price),
      promo_price: p.promo_price !== null ? String(p.promo_price) : '',
      stock_qty: String(p.stock_qty),
      is_active: p.is_active,
      is_bestseller: p.is_bestseller,
      is_new: p.is_new,
      images: p.images || [],
      primary_image: p.primary_image || p.images[0] || '',
      specs: {
        movement: p.specs?.movement || '',
        case_material: p.specs?.case_material || '',
        diameter: p.specs?.diameter || '',
        water_resistance: p.specs?.water_resistance || '',
        strap: p.specs?.strap || '',
        warranty: p.specs?.warranty || '2 ans Atelier Horlogerie Zeina',
      },
    });
    setModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('image', file);
        const res = await fetch('/api/admin/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (res.ok) {
          const data = await res.json();
          setForm((prev) => {
            const nextImgs = [...prev.images, data.url];
            return {
              ...prev,
              images: nextImgs,
              primary_image: prev.primary_image || data.url,
            };
          });
        }
      }
      showToast('Image(s) importée(s) avec succès.', 'success');
    } catch {
      showToast('Erreur lors du téléversement.', 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const addImageUrl = () => {
    const url = imageUrlInput.trim();
    if (!url) return;
    setForm((prev) => ({
      ...prev,
      images: [...prev.images, url],
      primary_image: prev.primary_image || url,
    }));
    setImageUrlInput('');
  };

  const removeImage = (url: string) => {
    setForm((prev) => {
      const next = prev.images.filter((i) => i !== url);
      return {
        ...prev,
        images: next,
        primary_image: prev.primary_image === url ? next[0] || '' : prev.primary_image,
      };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price) {
      showToast('Nom et prix requis.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        category_id: Number(form.category_id),
        price: Number(form.price),
        promo_price: form.promo_price ? Number(form.promo_price) : null,
        stock_qty: Math.max(0, Number(form.stock_qty) || 0),
      };

      const url = editingId ? `/api/admin/products/${editingId}` : '/api/admin/products';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        showToast(err.error || 'Erreur lors de la sauvegarde.', 'error');
        return;
      }

      showToast(editingId ? 'Produit mis à jour.' : 'Nouveau produit ajouté.', 'success');
      setModalOpen(false);
      loadData();
    } catch {
      showToast('Erreur réseau.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: Product) => {
    const res = await fetch(`/api/admin/products/${p.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ is_active: !p.is_active }),
    });
    if (res.ok) {
      showToast(p.is_active ? 'Produit désactivé.' : 'Produit activé.', 'info');
      loadData();
    }
  };

  const handleDelete = async (p: Product) => {
    const res = await fetch(`/api/admin/products/${p.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      showToast(`« ${p.name} » supprimé.`, 'info');
      loadData();
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const res = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: newCatName.trim() }),
    });
    if (res.ok) {
      setNewCatName('');
      showToast('Catégorie ajoutée.', 'success');
      await loadData();
      await refreshSettings();
    } else {
      const err = await res.json();
      showToast(err.error || 'Impossible d’ajouter la catégorie.', 'error');
    }
  };

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.reference || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.category_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="bg-white border border-neutral-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un produit, référence..."
            className="w-full pl-9 pr-3 py-2 min-h-[44px] bg-neutral-50 border border-neutral-200 text-base sm:text-sm focus:outline-none focus:border-neutral-900"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleAddCategory} className="flex items-center gap-1.5">
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Nouvelle catégorie..."
              className="px-3 py-2 min-h-[44px] bg-neutral-50 border border-neutral-200 text-base sm:text-xs focus:outline-none focus:border-neutral-900 w-40"
            />
            <button
              type="submit"
              className="px-3 py-2 min-h-[44px] border border-neutral-300 text-xs font-medium hover:bg-neutral-100 whitespace-nowrap cursor-pointer"
            >
              + Catégorie
            </button>
          </form>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] bg-[#0B0B0C] text-white text-xs font-medium hover:bg-neutral-800 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#C5A46D]" />
            <span>Ajouter un produit</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-neutral-200 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-600">
              <th className="py-3 px-4">Produit</th>
              <th className="py-3 px-4">Catégorie</th>
              <th className="py-3 px-4 text-right">Prix</th>
              <th className="py-3 px-4 text-right">Promo</th>
              <th className="py-3 px-4 text-right">Stock</th>
              <th className="py-3 px-4">Statut</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 text-sm">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-neutral-500 text-xs">
                  Chargement du catalogue...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-neutral-500 text-xs">
                  Aucun produit trouvé.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-50/80 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-10 bg-neutral-100 shrink-0 overflow-hidden border border-neutral-200">
                        <ResilientImage
                          src={p.primary_image || p.images[0]}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-neutral-900 truncate max-w-[220px]">
                          {p.name}
                        </p>
                        <p className="text-xs text-neutral-500 font-mono">
                          {p.reference || '—'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs text-neutral-600">{p.category_name}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">
                    {formatPrice(p.price)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-[#A6854E] font-medium">
                    {p.promo_price !== null ? formatPrice(p.promo_price) : '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">
                    <span className={p.stock_qty <= 2 ? 'text-red-600 font-semibold' : ''}>
                      {p.stock_qty}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => toggleActive(p)}
                      className={`px-2.5 py-1 text-xs font-medium border cursor-pointer ${
                        p.is_active
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-neutral-100 text-neutral-600 border-neutral-200'
                      }`}
                    >
                      {p.is_active ? 'Actif' : 'Masqué'}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditModal(p)}
                        title="Modifier"
                        className="p-1.5 text-neutral-600 hover:text-neutral-900 border border-neutral-200 hover:border-neutral-400 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p)}
                        title="Supprimer"
                        className="p-1.5 text-neutral-500 hover:text-red-600 border border-neutral-200 hover:border-red-300 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Product Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white border border-neutral-200 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
              <h3 className="font-serif text-xl font-semibold text-neutral-900">
                {editingId ? 'Modifier le produit' : 'Nouveau produit'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-neutral-500 hover:text-neutral-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Nom du produit *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 text-sm focus:outline-none focus:border-neutral-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Catégorie *
                  </label>
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-neutral-300 text-sm focus:outline-none focus:border-neutral-900"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Référence
                  </label>
                  <input
                    type="text"
                    value={form.reference}
                    onChange={(e) => setForm({ ...form, reference: e.target.value })}
                    placeholder="MK-001"
                    className="w-full px-3 py-2 border border-neutral-300 text-sm font-mono focus:outline-none focus:border-neutral-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Prix normal *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 text-sm font-mono focus:outline-none focus:border-neutral-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Prix promo
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.promo_price}
                    onChange={(e) => setForm({ ...form, promo_price: e.target.value })}
                    placeholder="Optionnel"
                    className="w-full px-3 py-2 border border-neutral-300 text-sm font-mono focus:outline-none focus:border-neutral-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Stock *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={form.stock_qty}
                    onChange={(e) => setForm({ ...form, stock_qty: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 text-sm font-mono focus:outline-none focus:border-neutral-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 text-sm focus:outline-none focus:border-neutral-900"
                />
              </div>

              {/* Specs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-neutral-50 p-4 border border-neutral-200">
                <div>
                  <label className="block text-[11px] text-neutral-600 mb-1">Mouvement</label>
                  <input
                    type="text"
                    value={form.specs.movement}
                    onChange={(e) =>
                      setForm({ ...form, specs: { ...form.specs, movement: e.target.value } })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-neutral-600 mb-1">Boîtier</label>
                  <input
                    type="text"
                    value={form.specs.case_material}
                    onChange={(e) =>
                      setForm({ ...form, specs: { ...form.specs, case_material: e.target.value } })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-neutral-600 mb-1">Diamètre</label>
                  <input
                    type="text"
                    value={form.specs.diameter}
                    onChange={(e) =>
                      setForm({ ...form, specs: { ...form.specs, diameter: e.target.value } })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-neutral-600 mb-1">Étanchéité</label>
                  <input
                    type="text"
                    value={form.specs.water_resistance}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        specs: { ...form.specs, water_resistance: e.target.value },
                      })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-neutral-600 mb-1">Bracelet</label>
                  <input
                    type="text"
                    value={form.specs.strap}
                    onChange={(e) =>
                      setForm({ ...form, specs: { ...form.specs, strap: e.target.value } })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-neutral-600 mb-1">Garantie</label>
                  <input
                    type="text"
                    value={form.specs.warranty}
                    onChange={(e) =>
                      setForm({ ...form, specs: { ...form.specs, warranty: e.target.value } })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 text-xs"
                  />
                </div>
              </div>

              {/* Images Manager */}
              <div className="space-y-3">
                <label className="block text-xs font-medium text-neutral-700">
                  Photos du produit (cliquez sur l’étoile pour définir l’image principale)
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-neutral-100 border border-neutral-300 text-xs font-medium hover:bg-neutral-200 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploading ? 'Importation...' : 'Importer des photos'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  <div className="flex-1 flex items-center gap-1.5 min-w-[200px]">
                    <input
                      type="text"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      placeholder="Ou coller une URL d'image..."
                      className="flex-1 px-3 py-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-900"
                    />
                    <button
                      type="button"
                      onClick={addImageUrl}
                      className="px-3 py-2 border border-neutral-300 text-xs font-medium hover:bg-neutral-100 cursor-pointer"
                    >
                      Ajouter
                    </button>
                  </div>
                </div>

                {form.images.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 pt-2">
                    {form.images.map((imgUrl) => {
                      const isPrimary = form.primary_image === imgUrl;
                      return (
                        <div
                          key={imgUrl}
                          className={`relative aspect-[4/3] border overflow-hidden group ${
                            isPrimary ? 'border-[#C5A46D] ring-2 ring-[#C5A46D]' : 'border-neutral-200'
                          }`}
                        >
                          <ResilientImage
                            src={imgUrl}
                            alt="Aperçu produit"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-x-0 top-0 p-1 flex justify-between bg-black/40">
                            <button
                              type="button"
                              onClick={() => setForm({ ...form, primary_image: imgUrl })}
                              title="Définir comme image principale"
                              className={`p-1 cursor-pointer ${
                                isPrimary ? 'text-[#C5A46D]' : 'text-white/75 hover:text-white'
                              }`}
                            >
                              <Star className="w-3.5 h-3.5 fill-current" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeImage(imgUrl)}
                              title="Retirer cette image"
                              className="p-1 text-white/80 hover:text-red-400 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Flags */}
              <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-neutral-200 text-xs">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    className="accent-[#0B0B0C]"
                  />
                  <span>Visible sur la boutique</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_bestseller}
                    onChange={(e) => setForm({ ...form, is_bestseller: e.target.checked })}
                    className="accent-[#0B0B0C]"
                  />
                  <span>Meilleure vente</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_new}
                    onChange={(e) => setForm({ ...form, is_new: e.target.checked })}
                    className="accent-[#0B0B0C]"
                  />
                  <span>Nouveauté</span>
                </label>
              </div>

              <div className="pt-4 border-t border-neutral-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-neutral-300 text-xs font-medium hover:bg-neutral-50 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#0B0B0C] text-white text-xs font-medium hover:bg-neutral-800 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Upload, Save, Lock } from 'lucide-react';
import { BusinessSettings } from '../../types';
import { useStore } from '../../context/StoreContext';
import { ResilientImage } from '../../components/ResilientImage';

interface AdminSettingsProps {
  token: string;
}

export function AdminSettings({ token }: AdminSettingsProps) {
  const { settings, refreshSettings, showToast } = useStore();
  const [form, setForm] = useState<BusinessSettings>(settings);
  const [saving, setSaving] = useState(false);

  const [pwdForm, setPwdForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleImageUpload = async (
    field: 'logo_url' | 'hero_image' | 'repair_banner_image',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);

    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    if (res.ok) {
      const data = await res.json();
      setForm((prev) => ({ ...prev, [field]: data.url }));
      showToast('Image importée. Cliquez sur Enregistrer pour publier.', 'info');
    } else {
      showToast('Erreur lors du téléversement.', 'error');
    }
    e.target.value = '';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        await refreshSettings();
        showToast('Personnalisation enregistrée et publiée sur le site.', 'success');
      } else {
        showToast('Impossible de sauvegarder les modifications.', 'error');
      }
    } catch {
      showToast('Erreur réseau.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwdForm.new_password.length < 8) {
      showToast('Le nouveau mot de passe doit contenir au moins 8 caractères.', 'error');
      return;
    }
    if (pwdForm.new_password !== pwdForm.confirm_password) {
      showToast('La confirmation du mot de passe ne correspond pas.', 'error');
      return;
    }
    setSavingPwd(true);
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: pwdForm.current_password,
          new_password: pwdForm.new_password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Impossible de modifier le mot de passe.', 'error');
        return;
      }
      setPwdForm({ current_password: '', new_password: '', confirm_password: '' });
      showToast('Mot de passe administrateur mis à jour avec succès.', 'success');
    } catch {
      showToast('Erreur réseau.', 'error');
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <div className="space-y-6">
    <form onSubmit={handleSave} className="space-y-6">
      <div className="bg-white border border-neutral-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Personnalisation du site</h2>
          <p className="text-xs text-neutral-500">
            Toute modification est immédiatement visible sur la boutique publique.
          </p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0B0B0C] text-white text-xs font-medium hover:bg-neutral-800 disabled:opacity-50 cursor-pointer self-start sm:self-auto"
        >
          <Save className="w-4 h-4 text-[#C5A46D]" />
          <span>{saving ? 'Publication...' : 'Enregistrer et publier'}</span>
        </button>
      </div>

      {/* Identity & Images */}
      <div className="bg-white border border-neutral-200 p-6 space-y-5">
        <h3 className="text-sm font-semibold text-neutral-900 border-b border-neutral-100 pb-3">
          Identité visuelle, logo & bannières
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Logo */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-neutral-700">Logo de la marque</label>
            <div className="h-28 bg-neutral-900 border border-neutral-200 flex items-center justify-center p-3 overflow-hidden">
              {form.logo_url ? (
                <ResilientImage
                  src={form.logo_url}
                  alt="Logo"
                  dark
                  className="max-h-full w-auto object-contain"
                />
              ) : (
                <span className="font-serif text-lg text-[#C5A46D]">{form.brand_name}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 border border-neutral-300 text-xs font-medium hover:bg-neutral-200 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Importer logo</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => handleImageUpload('logo_url', e)}
                  className="hidden"
                />
              </label>
              {form.logo_url && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, logo_url: '' })}
                  className="text-xs text-red-600 hover:underline cursor-pointer"
                >
                  Retirer
                </button>
              )}
            </div>
          </div>

          {/* Hero Image */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-neutral-700">
              Image principale Hero
            </label>
            <div className="h-28 bg-neutral-100 border border-neutral-200 overflow-hidden">
              <ResilientImage
                src={form.hero_image}
                alt="Hero"
                className="w-full h-full object-cover"
              />
            </div>
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 border border-neutral-300 text-xs font-medium hover:bg-neutral-200 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Changer l’image Hero</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleImageUpload('hero_image', e)}
                className="hidden"
              />
            </label>
          </div>

          {/* Repair Banner */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-neutral-700">
              Bannière Atelier Réparation
            </label>
            <div className="h-28 bg-neutral-100 border border-neutral-200 overflow-hidden">
              <ResilientImage
                src={form.repair_banner_image}
                alt="Atelier"
                className="w-full h-full object-cover"
              />
            </div>
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 border border-neutral-300 text-xs font-medium hover:bg-neutral-200 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Changer la bannière</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleImageUpload('repair_banner_image', e)}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Texts & Slogans */}
      <div className="bg-white border border-neutral-200 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-neutral-900 border-b border-neutral-100 pb-3">
          Textes, slogans & descriptions
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Nom de la maison
            </label>
            <input
              type="text"
              value={form.brand_name}
              onChange={(e) => setForm({ ...form, brand_name: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Slogan principal (Hero)
            </label>
            <input
              type="text"
              value={form.hero_slogan}
              onChange={(e) => setForm({ ...form, hero_slogan: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">
            Sous-titre Hero
          </label>
          <textarea
            rows={2}
            value={form.hero_subtitle}
            onChange={(e) => setForm({ ...form, hero_subtitle: e.target.value })}
            className="w-full px-3 py-2 border border-neutral-300 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Titre section Réparation
            </label>
            <input
              type="text"
              value={form.repair_title}
              onChange={(e) => setForm({ ...form, repair_title: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Titre section À propos
            </label>
            <input
              type="text"
              value={form.about_title}
              onChange={(e) => setForm({ ...form, about_title: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Description Réparation
            </label>
            <textarea
              rows={3}
              value={form.repair_description}
              onChange={(e) => setForm({ ...form, repair_description: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Texte À propos de notre horlogerie
            </label>
            <textarea
              rows={3}
              value={form.about_text}
              onChange={(e) => setForm({ ...form, about_text: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Contact, Socials & Delivery */}
      <div className="bg-white border border-neutral-200 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-neutral-900 border-b border-neutral-100 pb-3">
          Coordonnées, réseaux sociaux & livraison
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Téléphone</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">E-mail</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Adresse</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Lien Google Maps
            </label>
            <input
              type="url"
              value={form.google_maps_url}
              onChange={(e) => setForm({ ...form, google_maps_url: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Instagram</label>
            <input
              type="url"
              value={form.instagram_url}
              onChange={(e) => setForm({ ...form, instagram_url: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Facebook</label>
            <input
              type="url"
              value={form.facebook_url}
              onChange={(e) => setForm({ ...form, facebook_url: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Devise</label>
            <input
              type="text"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 text-base sm:text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Frais de livraison
            </label>
            <input
              type="number"
              min={0}
              value={form.delivery_fee}
              onChange={(e) => setForm({ ...form, delivery_fee: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 text-base sm:text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Seuil livraison gratuite
            </label>
            <input
              type="number"
              min={0}
              value={form.free_delivery_threshold}
              onChange={(e) => setForm({ ...form, free_delivery_threshold: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 text-base sm:text-sm font-mono"
            />
          </div>
        </div>
      </div>
    </form>

    {/* Security / Password Change */}
    <form onSubmit={handleChangePassword} className="bg-white border border-neutral-200 p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#A6854E]" />
            <span>Sécurité du compte administrateur</span>
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Modifiez votre mot de passe administrateur (8 caractères minimum).
          </p>
        </div>
        <button
          type="submit"
          disabled={savingPwd}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-[#0B0B0C] text-white text-xs font-medium hover:bg-neutral-800 disabled:opacity-50 cursor-pointer self-start sm:self-auto"
        >
          <Lock className="w-3.5 h-3.5 text-[#C5A46D]" />
          <span>{savingPwd ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">
            Mot de passe actuel *
          </label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={pwdForm.current_password}
            onChange={(e) => setPwdForm({ ...pwdForm, current_password: e.target.value })}
            className="w-full px-3 py-2 border border-neutral-300 text-base sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">
            Nouveau mot de passe *
          </label>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={pwdForm.new_password}
            onChange={(e) => setPwdForm({ ...pwdForm, new_password: e.target.value })}
            className="w-full px-3 py-2 border border-neutral-300 text-base sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">
            Confirmer le mot de passe *
          </label>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={pwdForm.confirm_password}
            onChange={(e) => setPwdForm({ ...pwdForm, confirm_password: e.target.value })}
            className="w-full px-3 py-2 border border-neutral-300 text-base sm:text-sm"
          />
        </div>
      </div>
    </form>
    </div>
  );
}

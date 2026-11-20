import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Watch,
  ShoppingCart,
  Calendar,
  Settings,
  LogOut,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { AdminOverview } from './admin/AdminOverview';
import { AdminProducts } from './admin/AdminProducts';
import { AdminOrders } from './admin/AdminOrders';
import { AdminAppointments } from './admin/AdminAppointments';
import { AdminSettings } from './admin/AdminSettings';

type AdminTab = 'overview' | 'products' | 'orders' | 'appointments' | 'settings';

const ADMIN_TOKEN_KEY = 'maison_kanalou_admin_token';

export function AdminPage() {
  const { settings, showToast } = useStore();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(ADMIN_TOKEN_KEY));
  const [adminUser, setAdminUser] = useState<{ full_name: string; username: string } | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(Boolean(token));

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  useEffect(() => {
    if (!token) {
      setCheckingAuth(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch('/api/admin/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setAdminUser(data.admin);
        } else {
          localStorage.removeItem(ADMIN_TOKEN_KEY);
          setToken(null);
        }
      } catch {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        setToken(null);
      } finally {
        setCheckingAuth(false);
      }
    })();
  }, [token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Identifiants invalides.');
        return;
      }
      localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      setToken(data.token);
      setAdminUser(data.admin);
      showToast('Connexion administrateur réussie.', 'success');
    } catch {
      setLoginError('Impossible de joindre le serveur.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (token) {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken(null);
    setAdminUser(null);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#0B0B0C] flex items-center justify-center text-[#F7F5F0] text-sm">
        Vérification de la session...
      </div>
    );
  }

  if (!token || !adminUser) {
    return (
      <div className="min-h-screen bg-[#0B0B0C] text-[#F7F5F0] flex flex-col justify-center items-center px-4">
        <div className="w-full max-w-md bg-[#141417] border border-white/15 p-8 sm:p-10">
          <div className="flex items-center gap-2.5 text-[#C5A46D] mb-3">
            <Lock className="w-4 h-4" />
            <span className="text-xs font-medium tracking-[0.2em]">ESPACE PROTÉGÉ</span>
          </div>
          <h1 className="font-serif text-3xl font-semibold text-white mb-1">
            {settings.brand_name || 'Horlogerie Zeina'}
          </h1>
          <p className="text-xs text-white/60 mb-7">
            Connectez-vous pour accéder à l’administration de la boutique et de l’atelier.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">Identifiant</label>
              <input
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full px-3.5 py-2.5 min-h-[44px] bg-[#0B0B0C] border border-white/20 text-base sm:text-sm text-white focus:outline-none focus:border-[#C5A46D]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">Mot de passe</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 min-h-[44px] bg-[#0B0B0C] border border-white/20 text-base sm:text-sm text-white focus:outline-none focus:border-[#C5A46D]"
              />
            </div>

            {loginError && (
              <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/60 px-3 py-2">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-3 min-h-[44px] bg-[#C5A46D] text-[#0B0B0C] text-sm font-semibold hover:bg-[#D4B680] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loggingIn ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/10 text-center">
            <Link to="/" className="text-xs text-white/55 hover:text-[#C5A46D] transition-colors">
              ← Retour à la boutique publique
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const navItems: Array<{ id: AdminTab; label: string; icon: React.ComponentType<any> }> = [
    { id: 'overview', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'products', label: 'Produits', icon: Watch },
    { id: 'orders', label: 'Commandes', icon: ShoppingCart },
    { id: 'appointments', label: 'Rendez-vous', icon: Calendar },
    { id: 'settings', label: 'Personnalisation', icon: Settings },
  ];

  const activeLabel = navItems.find((n) => n.id === activeTab)?.label || '';

  return (
    <div className="min-h-screen bg-[#F4F4F5] text-neutral-900 flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 bg-[#0B0B0C] text-[#F7F5F0] shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r border-white/10">
        <div className="px-6 py-5 border-b border-white/10">
          <p className="font-serif text-xl font-semibold text-white">
            {settings.brand_name || 'Horlogerie Zeina'}
          </p>
          <p className="text-[11px] text-[#C5A46D] mt-0.5">Administration</p>
        </div>

        <nav className="flex lg:flex-col overflow-x-auto no-scrollbar lg:overflow-visible p-3 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-3 px-3.5 py-2.5 min-h-[44px] text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#C5A46D] text-[#0B0B0C] font-semibold'
                    : 'text-white/75 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="hidden lg:flex flex-col gap-2 mt-auto p-4 border-t border-white/10">
          <Link
            to="/"
            className="inline-flex items-center justify-between px-3 py-2 text-xs text-white/75 hover:text-white border border-white/15 hover:border-white/30 transition-colors"
          >
            <span>Voir le site public</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between gap-4">
          <div className="text-xs text-neutral-500">
            <span>Administration</span>
            <span className="mx-2">/</span>
            <span className="font-semibold text-neutral-900">{activeLabel}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-600 hidden sm:inline">
              {adminUser.full_name}
            </span>
            <Link
              to="/"
              className="lg:hidden min-h-[40px] inline-flex items-center px-2 text-xs font-medium text-neutral-700 hover:text-neutral-900 whitespace-nowrap"
            >
              Site public
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="lg:hidden min-h-[40px] inline-flex items-center px-2 text-xs font-medium text-red-600 whitespace-nowrap cursor-pointer"
            >
              Déconnexion
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-7 max-w-7xl w-full mx-auto min-w-0">
          {activeTab === 'overview' && <AdminOverview token={token} />}
          {activeTab === 'products' && <AdminProducts token={token} />}
          {activeTab === 'orders' && <AdminOrders token={token} />}
          {activeTab === 'appointments' && <AdminAppointments token={token} />}
          {activeTab === 'settings' && <AdminSettings token={token} />}
        </main>
      </div>
    </div>
  );
}

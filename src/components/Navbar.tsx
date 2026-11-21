import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../context/StoreContext';
import { BrandWordmark } from './BrandWordmark';

export function Navbar() {
  const { settings, cartCount, openCart } = useStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { label: 'Accueil', to: '/' },
    { label: 'Boutique', to: '/boutique' },
    { label: 'Hommes', to: '/boutique?category=hommes' },
    { label: 'Femmes', to: '/boutique?category=femmes' },
    { label: 'Accessoires', to: '/boutique?category=accessoires' },
    { label: 'Réparation', to: '/reparation' },
    { label: 'Contact', to: '/contact' },
  ];

  const isActive = (to: string) => {
    const full = `${location.pathname}${location.search}`;
    if (to === '/') return location.pathname === '/' && !location.search;
    if (to.includes('?')) return full === to;
    return location.pathname === to && !location.search;
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0A0A0B]/88 backdrop-blur-xl border-b border-[#C4A773]/18 text-[#F5F2EB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-[72px] flex items-center justify-between gap-8">
        {/* Zone 1: Brand wordmark with watch-O */}
        <Link
          to="/"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-2.5 min-w-0 shrink-0 group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C4A773]"
        >
          {settings.logo_url ? (
            <img
              src={settings.logo_url}
              alt={settings.brand_name}
              referrerPolicy="no-referrer"
              className="h-8 w-auto object-contain shrink-0 transition-transform duration-200 group-hover:scale-105"
            />
          ) : null}
          <BrandWordmark
            name={settings.brand_name || 'Horlogerie Zeina'}
            size="nav"
            className="text-[#F5F2EB] group-hover:text-[#D5BC8E] transition-colors duration-200"
          />
        </Link>

        {/* Zone 2: Clean single-line navigation */}
        <nav
          aria-label="Navigation principale"
          className="hidden lg:flex items-center gap-7 text-[13px] font-normal tracking-[0.03em]"
        >
          {navItems.map((item) => {
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`relative whitespace-nowrap shrink-0 py-1.5 transition-colors duration-200 ${
                  active ? 'text-[#C4A773]' : 'text-[#F5F2EB]/70 hover:text-[#F5F2EB]'
                }`}
              >
                {item.label}
                {active && (
                  <motion.span
                    layoutId="nav-active-underline"
                    transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                    className="absolute inset-x-0 -bottom-0.5 h-[1px] bg-[#C4A773]"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Zone 3: Restrained luxury Panier button */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => openCart('cart')}
            className="btn-sheen inline-flex items-center gap-2 px-3.5 sm:px-4 min-h-[44px] text-xs font-medium tracking-wider bg-[#141417] text-[#F5F2EB] border border-[#C4A773]/45 hover:border-[#C4A773] hover:text-[#C4A773] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C4A773] cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-[#C4A773] stroke-[1.5]" />
            <span className="hidden xs:inline sm:inline">Panier</span>
            <span className="font-mono tabular-nums text-[#C4A773]">({cartCount})</span>
          </motion.button>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center text-[#F5F2EB]/80 hover:text-white transition-colors cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden border-t border-white/10 bg-[#0A0A0B]/95 backdrop-blur-xl px-4 py-4"
          >
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={`px-3 min-h-[44px] flex items-center text-sm transition-colors ${
                    isActive(item.to)
                      ? 'text-[#C4A773] bg-white/[0.04]'
                      : 'text-[#F5F2EB]/80 hover:text-white hover:bg-white/[0.03]'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

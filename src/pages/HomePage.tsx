import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Truck, Wrench, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product } from '../types';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';
import { ResilientImage } from '../components/ResilientImage';
import { LocationSection } from '../components/LocationSection';

type ShowcaseTab = 'bestseller' | 'new' | 'hommes' | 'femmes' | 'accessoires';

const PRODUCTS_CACHE_KEY = 'hz_products_cache_v1';

export function HomePage() {
  const { settings, formatPrice } = useStore();
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const cached = sessionStorage.getItem(PRODUCTS_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      return !sessionStorage.getItem(PRODUCTS_CACHE_KEY);
    } catch {
      return true;
    }
  });
  const [activeTab, setActiveTab] = useState<ShowcaseTab>('bestseller');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/products');
        if (res.ok && active) {
          const data = await res.json();
          setProducts(data);
          try {
            sessionStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(data));
          } catch {
            // ignore storage errors
          }
        }
      } catch {
        // silent
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const heroProduct = products[0];

  const getFilteredProducts = () => {
    switch (activeTab) {
      case 'bestseller':
        return products.filter((p) => p.is_bestseller).slice(0, 3);
      case 'new':
        return products.filter((p) => p.is_new).slice(0, 3);
      case 'hommes':
        return products.filter((p) => p.category_slug === 'hommes').slice(0, 3);
      case 'femmes':
        return products.filter((p) => p.category_slug === 'femmes').slice(0, 3);
      case 'accessoires':
        return products.filter((p) => p.category_slug === 'accessoires').slice(0, 3);
    }
  };

  const displayedProducts = getFilteredProducts();

  const tabs: Array<{ id: ShowcaseTab; label: string }> = [
    { id: 'bestseller', label: 'Meilleures ventes' },
    { id: 'new', label: 'Nouveautés' },
    { id: 'hommes', label: 'Hommes' },
    { id: 'femmes', label: 'Femmes' },
    { id: 'accessoires', label: 'Accessoires' },
  ];

  const universes = [
    {
      title: 'Montres Hommes',
      subtitle: 'Calibres automatiques & chronographes',
      image: '/src/assets/images/watch_men_chronograph_1795182913892.jpg',
      to: '/boutique?category=hommes',
    },
    {
      title: 'Montres Femmes',
      subtitle: 'Nacre véritable & or champagne',
      image: '/src/assets/images/watch_women_gold_1795182912356.jpg',
      to: '/boutique?category=femmes',
    },
    {
      title: 'Bracelets & Accessoires',
      subtitle: 'Cuir italien cousu main',
      image: '/src/assets/images/watch_accessories_straps_1795182913032.jpg',
      to: '/boutique?category=accessoires',
    },
  ];

  const pillars = [
    { icon: ShieldCheck, title: 'Garantie 2 ans', desc: 'Contrôle chronométrique certifié.' },
    { icon: Truck, title: 'Paiement à la livraison', desc: 'Expédition partout en Tunisie.' },
    { icon: Wrench, title: 'Atelier à Zaghouan', desc: 'Réparation & restauration sur place.' },
    { icon: Award, title: 'Service sur mesure', desc: 'Mise à taille offerte en boutique.' },
  ];

  return (
    <div className="bg-[#F5F2EB] text-[#0A0A0B]">
      {/* 1. HERO SECTION */}
      <section className="relative bg-[#0A0A0B] text-[#F5F2EB] overflow-hidden min-h-[75vh] sm:min-h-[82vh] flex items-center">
        <motion.div
          initial={{ scale: 1.02, opacity: 0.9 }}
          animate={{ scale: 1, opacity: 0.85 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0"
        >
          <ResilientImage
            src={settings.hero_image}
            alt="Garde-temps de haute horlogerie Horlogerie Zeina"
            dark
            priority
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0B] via-[#0A0A0B]/75 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0B] via-transparent to-[#0A0A0B]/45" />
        </motion.div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 items-end">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-7"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-px bg-[#C4A773]" aria-hidden="true" />
                <p className="text-[11px] font-medium tracking-[0.26em] text-[#C4A773]">
                  HORLOGERIE ZEINA · ZAGHOUAN
                </p>
              </div>
              <h1 className="font-serif text-3xl sm:text-5xl lg:text-[3.5rem] font-medium leading-[1.06] text-balance text-[#F5F2EB] mb-5">
                {settings.hero_slogan}
              </h1>
              {settings.hero_subtitle && (
                <p className="text-sm sm:text-[15px] text-[#F5F2EB]/72 max-w-xl leading-relaxed mb-8">
                  {settings.hero_subtitle}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-4">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    to="/boutique"
                    className="btn-sheen inline-flex items-center gap-2.5 px-7 py-3.5 bg-[#C4A773] text-[#0A0A0B] text-xs font-semibold tracking-wider hover:bg-[#D1B786] transition-colors whitespace-nowrap"
                  >
                    <span>Découvrir la collection</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    to="/reparation"
                    className="liquid-glass-dark inline-flex items-center gap-2 px-6 py-3.5 text-[#F5F2EB] text-xs font-medium tracking-wider hover:border-[#C4A773]/60 hover:text-[#C4A773] transition-colors whitespace-nowrap"
                  >
                    <span>Prendre rendez-vous</span>
                  </Link>
                </motion.div>
              </div>
            </motion.div>

            {/* Floating Liquid Glass Signature Card */}
            {heroProduct && (
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -4 }}
                className="lg:col-span-5 lg:justify-self-end w-full max-w-md"
              >
                <Link
                  to={`/produit/${heroProduct.slug}`}
                  className="liquid-glass-dark block p-5 sm:p-6 group transition-all duration-300 hover:border-[#C4A773]/50"
                >
                  <div className="flex items-center justify-between text-[10px] tracking-[0.22em] text-[#C4A773] mb-3">
                    <span>PIÈCE SIGNATURE</span>
                    <span className="font-mono tabular-nums">{heroProduct.reference}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {(heroProduct.primary_image || heroProduct.images?.[0]) && (
                      <div className="w-20 h-16 shrink-0 bg-[#141417] border border-white/10 overflow-hidden">
                        <ResilientImage
                          src={heroProduct.primary_image || heroProduct.images[0]}
                          alt={heroProduct.name}
                          dark
                          priority
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[11px] text-[#F5F2EB]/55 mb-0.5 truncate">
                        {heroProduct.category_name}
                      </p>
                      <h2 className="font-serif text-xl sm:text-2xl font-medium text-[#F5F2EB] group-hover:text-[#C4A773] transition-colors truncate">
                        {heroProduct.name}
                      </h2>
                    </div>
                  </div>
                  <div className="mt-4 pt-3.5 border-t border-white/10 flex items-center justify-between">
                    <span className="font-mono tabular-nums text-base font-medium text-[#F5F2EB]">
                      {formatPrice(heroProduct.promo_price ?? heroProduct.price)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#C4A773] group-hover:translate-x-1 transition-transform">
                      <span>Explorer</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* 2. INTERACTIVE COLLECTION SHOWCASE */}
      <section className="py-20 bg-[#F5F2EB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
            <div>
              <p className="text-[11px] font-medium tracking-[0.22em] text-[#85693A] mb-1.5">
                COLLECTIONS
              </p>
              <h2 className="font-serif text-3xl sm:text-4xl font-medium text-[#0A0A0B]">
                Garde-temps sélectionnés
              </h2>
            </div>

            <div className="liquid-glass p-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full self-start lg:self-auto">
              {tabs.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative px-4 min-h-[40px] text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active ? 'text-[#F5F2EB]' : 'text-[#5A5449] hover:text-[#0A0A0B]'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="home-collection-tab"
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                        className="absolute inset-0 bg-[#0A0A0B]"
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-96 bg-[#EAE5DA] animate-pulse" />
              ))}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7"
              >
                {(displayedProducts.length > 0 ? displayedProducts : products.slice(0, 3)).map(
                  (product) => (
                    <ProductCard key={product.id} product={product} />
                  )
                )}
              </motion.div>
            </AnimatePresence>
          )}

          <div className="mt-12 text-center">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} className="inline-block">
              <Link
                to="/boutique"
                className="inline-flex items-center gap-2 px-7 py-3 border border-[#0A0A0B]/25 text-[#0A0A0B] text-xs font-medium tracking-wider hover:bg-[#0A0A0B] hover:text-[#F5F2EB] transition-colors"
              >
                <span>Voir tout le catalogue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 3. VISUAL UNIVERSES (HOMMES / FEMMES / ACCESSOIRES) */}
      <section className="py-16 sm:py-20 bg-[#F5F2EB] border-t border-[#0A0A0B]/8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {universes.map((u, idx) => (
              <motion.div
                key={u.title}
                initial={{ opacity: 0.9, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.35, delay: idx * 0.06 }}
              >
                <Link
                  to={u.to}
                  className="group relative block aspect-[4/3] overflow-hidden bg-[#141417] border border-[#0A0A0B]/10 hover:border-[#C4A773]/60 transition-colors"
                >
                  <ResilientImage
                    src={u.image}
                    alt={u.title}
                    dark
                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/20 to-transparent" />
                  <div className="liquid-glass-dark absolute inset-x-4 bottom-4 p-4 flex items-center justify-between gap-3 transition-transform duration-300 group-hover:-translate-y-1">
                    <div>
                      <span className="block font-mono text-[10px] tracking-[0.2em] text-[#C4A773] mb-0.5">
                        0{idx + 1}.
                      </span>
                      <h3 className="font-serif text-xl font-medium text-[#F5F2EB]">{u.title}</h3>
                      <p className="text-xs text-[#F5F2EB]/65">{u.subtitle}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#C4A773] shrink-0 transition-transform duration-200 group-hover:translate-x-1" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. ARCHITECTURAL ENGAGEMENTS STRIP */}
      <section className="py-12 bg-[#F5F2EB] border-t border-[#0A0A0B]/8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#FAF8F4] border border-[#0A0A0B]/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#0A0A0B]/10">
            {pillars.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="p-6 sm:p-7 flex flex-col">
                  <Icon className="w-5 h-5 text-[#85693A] mb-3.5 stroke-[1.35]" />
                  <h3 className="font-serif text-lg font-medium text-[#0A0A0B] mb-1">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[#5A5449] leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. ATELIER DE RÉPARATION : LIQUID GLASS OVERLAY */}
      <section className="relative bg-[#0A0A0B] text-[#F5F2EB] overflow-hidden py-24">
        <div className="absolute inset-0">
          <ResilientImage
            src={settings.repair_banner_image}
            alt="Atelier de réparation horlogère Horlogerie Zeina"
            dark
            className="w-full h-full object-cover opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0B]/92 via-[#0A0A0B]/60 to-[#0A0A0B]/35" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.6 }}
            className="liquid-glass-dark max-w-xl p-8 sm:p-10"
          >
            <p className="text-[11px] font-medium tracking-[0.24em] text-[#C4A773] mb-2">
              ATELIER HORLOGER
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-medium text-[#F5F2EB] leading-tight mb-4">
              {settings.repair_title}
            </h2>
            <p className="text-sm text-[#F5F2EB]/75 mb-7">
              Révision mécanique, étanchéité, changement de pile et polissage par nos maîtres
              horlogers.
            </p>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} className="inline-block">
              <Link
                to="/reparation"
                className="btn-sheen inline-flex items-center gap-2.5 px-7 py-3.5 bg-[#C4A773] text-[#0A0A0B] text-xs font-semibold tracking-wider hover:bg-[#D1B786] transition-colors whitespace-nowrap"
              >
                <span>Prendre rendez-vous</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* 6. À PROPOS */}
      <section className="py-20 bg-[#F5F2EB] border-b border-[#0A0A0B]/8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="hairline-gold w-28 mx-auto mb-6" aria-hidden="true" />
          <p className="text-[11px] font-medium tracking-[0.26em] text-[#85693A] mb-2.5">
            NOTRE MAISON
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl font-medium text-[#0A0A0B] text-balance mb-5">
            {settings.about_title}
          </h2>
          <p className="text-sm sm:text-[15px] text-[#5A5449] leading-relaxed">{settings.about_text}</p>
        </div>
      </section>

      {/* 7. CONTACT & GOOGLE MAPS */}
      <LocationSection />
    </div>
  );
}

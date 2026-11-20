import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { motion } from 'motion/react';
import { Product } from '../types';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';

export function ShopPage() {
  const { categories } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialCat = searchParams.get('category') || 'all';
  const [category, setCategory] = useState(initialCat);
  const [search, setSearch] = useState('');
  const [inStock, setInStock] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState('popular');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const paramCat = searchParams.get('category') || 'all';
    setCategory(paramCat);
  }, [searchParams]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (category && category !== 'all') qs.set('category', category);
      if (search.trim()) qs.set('search', search.trim());
      if (inStock) qs.set('inStock', 'true');
      if (minPrice) qs.set('minPrice', minPrice);
      if (maxPrice) qs.set('maxPrice', maxPrice);
      if (sort) qs.set('sort', sort);

      const res = await fetch(`/api/products?${qs.toString()}`);
      if (res.ok) {
        setProducts(await res.json());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [category, search, inStock, minPrice, maxPrice, sort]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 150);
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  const handleCategoryChange = (slug: string) => {
    setCategory(slug);
    if (slug === 'all') {
      searchParams.delete('category');
    } else {
      searchParams.set('category', slug);
    }
    setSearchParams(searchParams);
  };

  const resetFilters = () => {
    setSearch('');
    setInStock(false);
    setMinPrice('');
    setMaxPrice('');
    setSort('popular');
    handleCategoryChange('all');
  };

  return (
    <div className="bg-[#F5F2EB] min-h-screen">
      {/* Header */}
      <section className="bg-[#0A0A0B] text-[#F5F2EB] py-14 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-[11px] font-medium tracking-[0.22em] text-[#C4A773] mb-2">
            CATALOGUE OFFICIEL
          </p>
          <h1 className="font-serif text-3xl sm:text-5xl font-semibold">
            Boutique Horlogère
          </h1>
          <p className="text-xs sm:text-sm text-white/65 mt-2">
            Montres automatiques, classiques et bracelets en cuir cousu main.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Liquid Glass Filter Bar */}
        <div className="liquid-glass p-4 sm:p-5 mb-8 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Animated Category Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => handleCategoryChange('all')}
                className={`relative px-4 min-h-[40px] text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  category === 'all' ? 'text-[#F5F2EB]' : 'text-[#4A463F] hover:text-[#111113]'
                }`}
              >
                {category === 'all' && (
                  <motion.span
                    layoutId="shop-cat-tab"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    className="absolute inset-0 bg-[#0A0A0B]"
                  />
                )}
                <span className="relative z-10">Toutes les pièces</span>
              </button>
              {categories.map((cat) => {
                const active = category === cat.slug;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategoryChange(cat.slug)}
                    className={`relative px-4 min-h-[40px] text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active ? 'text-[#F5F2EB]' : 'text-[#4A463F] hover:text-[#111113]'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="shop-cat-tab"
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                        className="absolute inset-0 bg-[#0A0A0B]"
                      />
                    )}
                    <span className="relative z-10">{cat.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div className="relative w-full lg:w-80">
              <Search className="w-4 h-4 text-[#6B665D] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un modèle, une référence..."
                className="w-full pl-10 pr-10 py-2 min-h-[44px] bg-[#F5F2EB] border border-[#E5E0D6] text-base sm:text-sm focus:outline-none focus:border-[#0A0A0B]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Effacer la recherche"
                  className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center text-[#6B665D] hover:text-[#111113] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-[#F0ECE3] flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <span className="inline-flex items-center gap-1.5 text-[#5A554C] font-medium">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#A6854E]" />
                Filtres :
              </span>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  placeholder="Prix min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-24 px-2.5 py-2 min-h-[40px] bg-[#F5F2EB] border border-[#E5E0D6] font-mono text-base sm:text-xs focus:outline-none focus:border-[#0A0A0B]"
                />
                <span className="text-[#8A8479]">–</span>
                <input
                  type="number"
                  min={0}
                  placeholder="Prix max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-24 px-2.5 py-2 min-h-[40px] bg-[#F5F2EB] border border-[#E5E0D6] font-mono text-base sm:text-xs focus:outline-none focus:border-[#0A0A0B]"
                />
              </div>

              <label className="inline-flex items-center gap-2 min-h-[40px] cursor-pointer select-none text-[#4A463F]">
                <input
                  type="checkbox"
                  checked={inStock}
                  onChange={(e) => setInStock(e.target.checked)}
                  className="accent-[#0A0A0B] w-4 h-4"
                />
                <span>En stock uniquement</span>
              </label>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              <span className="text-[#6B665D] tabular-nums">
                {products.length} modèle{products.length > 1 ? 's' : ''}
              </span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                aria-label="Trier les produits"
                className="px-3 py-2 min-h-[40px] bg-[#F7F5F0] border border-[#E5E0D6] text-base sm:text-xs focus:outline-none focus:border-[#0B0B0C]"
              >
                <option value="popular">Meilleures ventes</option>
                <option value="newest">Nouveautés</option>
                <option value="price_asc">Prix croissant</option>
                <option value="price_desc">Prix décroissant</option>
              </select>
            </div>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-96 bg-[#EFECE4] animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white border border-[#E5E0D6] py-16 px-6 text-center">
            <p className="font-serif text-2xl font-medium text-[#111113] mb-2">
              Aucune pièce ne correspond à votre recherche
            </p>
            <p className="text-sm text-[#6B665D] mb-6">
              Essayez d’élargir vos critères de prix ou de catégorie.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="px-5 py-2.5 bg-[#0B0B0C] text-[#F7F5F0] text-xs font-medium hover:bg-[#1E1E22] cursor-pointer"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

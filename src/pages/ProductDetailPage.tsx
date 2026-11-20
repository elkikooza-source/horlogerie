import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ShoppingBag, ArrowUpRight, ArrowLeft, Plus, Minus, ShieldCheck, Truck } from 'lucide-react';
import { motion } from 'motion/react';
import { Product } from '../types';
import { useStore } from '../context/StoreContext';
import { ResilientImage } from '../components/ResilientImage';
import { ProductCard } from '../components/ProductCard';

export function ProductDetailPage() {
  const { slug } = useParams();
  const { addToCart, formatPrice } = useStore();

  const [product, setProduct] = useState<Product | null>(null);
  const [similar, setSimilar] = useState<Product[]>([]);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    setLoading(true);
    setNotFound(false);
    setQuantity(1);

    (async () => {
      try {
        const res = await fetch(`/api/products/${slug}`);
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        setProduct(data.product);
        setSimilar(data.similar || []);
        setSelectedImage(data.product.primary_image || data.product.images[0] || '');
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 aspect-[4/3] bg-[#EFECE4] animate-pulse" />
          <div className="lg:col-span-5 h-96 bg-[#EFECE4] animate-pulse" />
        </div>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <h1 className="font-serif text-3xl font-semibold mb-3">Modèle introuvable</h1>
        <p className="text-sm text-[#6B665D] mb-6">
          Ce garde-temps n’est plus disponible ou a été déplacé.
        </p>
        <Link
          to="/boutique"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#0B0B0C] text-[#F7F5F0] text-xs font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à la boutique</span>
        </Link>
      </div>
    );
  }

  const allImages = Array.from(
    new Set([product.primary_image, ...(product.images || [])].filter(Boolean))
  );
  const effectivePrice = product.promo_price ?? product.price;
  const hasPromo = product.promo_price !== null && product.promo_price < product.price;
  const outOfStock = product.stock_qty <= 0;

  const specRows = [
    { label: 'Mouvement', value: product.specs?.movement },
    { label: 'Boîtier', value: product.specs?.case_material },
    { label: 'Diamètre / Dimensions', value: product.specs?.diameter },
    { label: 'Étanchéité', value: product.specs?.water_resistance },
    { label: 'Bracelet', value: product.specs?.strap },
    { label: 'Garantie', value: product.specs?.warranty },
  ].filter((r) => r.value);

  return (
    <div className="bg-[#F5F2EB] py-10 sm:py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          to="/boutique"
          className="inline-flex items-center gap-2 text-xs font-medium text-[#5A5449] hover:text-[#0A0A0B] mb-8"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Retour à la boutique</span>
        </Link>

        {/* Contiguous Purchase Module */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left: Gallery */}
          <div className="lg:col-span-7 space-y-4">
            <div className="aspect-[4/3] bg-[#EAE5DA] border border-[#0A0A0B]/10 overflow-hidden">
              <ResilientImage
                src={selectedImage || allImages[0]}
                alt={product.name}
                fallbackTitle={product.name}
                className="w-full h-full object-cover"
              />
            </div>

            {allImages.length > 1 && (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                {allImages.map((imgUrl, idx) => (
                  <button
                    key={`${imgUrl}-${idx}`}
                    type="button"
                    onClick={() => setSelectedImage(imgUrl)}
                    className={`aspect-[4/3] bg-white border overflow-hidden cursor-pointer transition-all ${
                      selectedImage === imgUrl
                        ? 'border-[#0B0B0C] ring-1 ring-[#0B0B0C]'
                        : 'border-[#E5E0D6] opacity-75 hover:opacity-100'
                    }`}
                  >
                    <ResilientImage
                      src={imgUrl}
                      alt={`${product.name} vue ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Purchase & Specs */}
          <div className="lg:col-span-5 bg-[#FAF8F4] border border-[#0A0A0B]/10 p-7 sm:p-8 lg:sticky lg:top-24">
            <div className="flex items-center gap-2 text-xs text-[#6E685D] mb-2">
              <span>{product.category_name}</span>
              {product.reference && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">Réf. {product.reference}</span>
                </>
              )}
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl font-medium text-[#0A0A0B] mb-4">
              {product.name}
            </h1>

            <div className="flex items-baseline gap-3 pb-5 border-b border-[#0A0A0B]/10">
              <span className="font-mono tabular-nums text-2xl font-semibold text-[#0A0A0B]">
                {formatPrice(effectivePrice)}
              </span>
              {hasPromo && (
                <span className="font-mono tabular-nums text-sm text-[#8E877B] line-through">
                  {formatPrice(product.price)}
                </span>
              )}
              <span
                className={`ml-auto text-xs font-medium tabular-nums ${
                  outOfStock ? 'text-[#8E877B]' : 'text-[#85693A]'
                }`}
              >
                {outOfStock
                  ? 'Épuisé'
                  : `Disponible (${product.stock_qty})`}
              </span>
            </div>

            <p className="text-sm text-[#4A463F] leading-relaxed py-5 border-b border-[#F0ECE3]">
              {product.description}
            </p>

            {/* Quantity & Actions */}
            <div className="py-6 space-y-4">
              {!outOfStock && (
                <div className="flex items-center gap-4">
                  <span className="text-xs font-medium text-[#5A554C]">Quantité</span>
                  <div className="inline-flex items-center border border-[#D8D2C5]">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-[#F7F5F0] cursor-pointer"
                      aria-label="Réduire"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-4 text-sm font-mono tabular-nums font-semibold">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(product.stock_qty, q + 1))}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-[#F7F5F0] cursor-pointer"
                      aria-label="Augmenter"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <motion.button
                  type="button"
                  whileHover={outOfStock ? undefined : { scale: 1.02 }}
                  whileTap={outOfStock ? undefined : { scale: 0.97 }}
                  disabled={outOfStock}
                  onClick={() => addToCart(product, quantity, false)}
                  className="btn-sheen min-h-[48px] py-3.5 px-5 bg-[#0A0A0B] text-[#F5F2EB] text-sm font-medium hover:bg-[#1C1C20] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4 text-[#C4A773]" />
                  <span>Ajouter au panier</span>
                </motion.button>
                <motion.button
                  type="button"
                  whileHover={outOfStock ? undefined : { scale: 1.02 }}
                  whileTap={outOfStock ? undefined : { scale: 0.97 }}
                  disabled={outOfStock}
                  onClick={() => addToCart(product, quantity, true)}
                  className="btn-sheen min-h-[48px] py-3.5 px-5 bg-[#C4A773] text-[#0A0A0B] text-sm font-semibold hover:bg-[#D1B786] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span>Acheter maintenant</span>
                  <ArrowUpRight className="w-4 h-4" />
                </motion.button>
              </div>
            </div>

            {/* Trust */}
            <div className="pt-4 border-t border-[#F0ECE3] space-y-2 text-xs text-[#5A554C]">
              <div className="flex items-center gap-2.5">
                <Truck className="w-4 h-4 text-[#A6854E]" />
                <span>Paiement à la livraison partout en Tunisie</span>
              </div>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#A6854E]" />
                <span>Certificat d’authenticité & garantie Horlogerie Zeina</span>
              </div>
            </div>

            {/* Technical Specs */}
            {specRows.length > 0 && (
              <div className="mt-6 pt-5 border-t border-[#F0ECE3]">
                <h2 className="text-xs font-semibold tracking-wider text-[#111113] mb-3">
                  CARACTÉRISTIQUES TECHNIQUES
                </h2>
                <dl className="divide-y divide-[#F0ECE3] text-xs">
                  {specRows.map((row) => (
                    <div key={row.label} className="py-2.5 flex justify-between gap-4">
                      <dt className="text-[#6B665D]">{row.label}</dt>
                      <dd className="text-[#111113] font-medium text-right">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>

        {/* Similar Products */}
        {similar.length > 0 && (
          <section className="mt-20 pt-14 border-t border-[#E5E0D6]">
            <h2 className="font-serif text-3xl font-semibold text-[#111113] mb-8">
              Pièces similaires
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
              {similar.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

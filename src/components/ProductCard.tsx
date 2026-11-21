import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, ArrowUpRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Product } from '../types';
import { useStore } from '../context/StoreContext';
import { ResilientImage } from './ResilientImage';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addToCart, formatPrice } = useStore();
  const [hovered, setHovered] = useState(false);

  const secondaryImage = product.images && product.images.length > 1 ? product.images[1] : null;
  const displayedImage =
    hovered && secondaryImage ? secondaryImage : product.primary_image || product.images[0];

  const effectivePrice = product.promo_price ?? product.price;
  const hasPromo =
    product.promo_price !== null && product.promo_price < product.price;
  const outOfStock = product.stock_qty <= 0;

  return (
    <motion.article
      initial={{ opacity: 0.9, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group flex flex-col bg-[#FAF8F4] border border-[#0A0A0B]/10 transition-shadow duration-300 hover:shadow-[0_18px_40px_-18px_rgba(10,10,11,0.18)]"
    >
      <Link
        to={`/produit/${product.slug}`}
        className="relative block aspect-[4/3] overflow-hidden bg-[#EAE5DA]"
      >
        <ResilientImage
          src={displayedImage}
          alt={product.name}
          fallbackTitle={product.name}
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
        {outOfStock ? (
          <div className="liquid-glass-dark absolute inset-x-0 bottom-0 text-[#F5F2EB] text-xs font-medium px-3 py-2 tracking-wide text-center">
            Épuisé
          </div>
        ) : hasPromo ? (
          <div className="liquid-glass-dark absolute top-3 left-3 text-[#C4A773] text-[11px] font-medium px-2.5 py-1 tracking-wider">
            Privilège
          </div>
        ) : product.is_new ? (
          <div className="liquid-glass absolute top-3 left-3 text-[#0A0A0B] text-[11px] font-medium px-2.5 py-1 tracking-wider">
            Nouveau
          </div>
        ) : null}
      </Link>

      <div className="flex-1 flex flex-col p-5">
        <div className="flex items-center gap-2 text-xs text-[#6E685D] mb-1">
          <span className="truncate">{product.category_name}</span>
          {product.reference ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{product.reference}</span>
            </>
          ) : null}
        </div>

        <Link
          to={`/produit/${product.slug}`}
          className="font-serif text-xl font-medium text-[#0A0A0B] group-hover:text-[#85693A] transition-colors line-clamp-1 mb-2"
        >
          {product.name}
        </Link>

        <div className="flex items-baseline gap-2.5 mb-5">
          <span className="font-mono tabular-nums text-sm font-semibold text-[#0A0A0B]">
            {formatPrice(effectivePrice)}
          </span>
          {hasPromo ? (
            <span className="font-mono tabular-nums text-xs text-[#8E877B] line-through">
              {formatPrice(product.price)}
            </span>
          ) : null}
          <span className="ml-auto text-[11px] text-[#6E685D] tabular-nums">
            {outOfStock ? 'Rupture' : `${product.stock_qty} disp.`}
          </span>
        </div>

        <div className="mt-auto pt-3.5 border-t border-[#0A0A0B]/8 flex items-center gap-2.5">
          <motion.button
            type="button"
            disabled={outOfStock}
            whileHover={outOfStock ? undefined : { scale: 1.015 }}
            whileTap={outOfStock ? undefined : { scale: 0.97 }}
            onClick={() => addToCart(product, 1, false)}
            className="btn-sheen flex-1 inline-flex items-center justify-center gap-1.5 px-3 min-h-[44px] text-xs font-medium bg-[#0A0A0B] text-[#F5F2EB] hover:bg-[#1C1C20] disabled:opacity-35 disabled:cursor-not-allowed transition-colors whitespace-nowrap cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-[#C4A773]" />
            <span>Ajouter</span>
          </motion.button>
          <motion.button
            type="button"
            disabled={outOfStock}
            whileHover={outOfStock ? undefined : { scale: 1.015 }}
            whileTap={outOfStock ? undefined : { scale: 0.97 }}
            onClick={() => addToCart(product, 1, true)}
            className="inline-flex items-center justify-center gap-1 px-3.5 min-h-[44px] text-xs font-medium border border-[#0A0A0B]/20 text-[#0A0A0B] hover:border-[#0A0A0B] hover:bg-[#0A0A0B]/5 disabled:opacity-35 disabled:cursor-not-allowed transition-colors whitespace-nowrap cursor-pointer"
          >
            <span>Acheter</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#85693A]" />
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
}

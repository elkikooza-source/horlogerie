import React, { useEffect, useState } from 'react';
import {
  X,
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Truck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../context/StoreContext';
import { Order } from '../types';
import { ResilientImage } from './ResilientImage';

type Step = 'cart' | 'checkout' | 'review' | 'confirmed';

export function CartDrawer() {
  const {
    cart,
    cartSubtotal,
    isCartOpen,
    initialCheckoutStep,
    closeCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    formatPrice,
    settings,
    showToast,
  } = useStore();

  const [step, setStep] = useState<Step>('cart');
  const [submitting, setSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    address: '',
    city: '',
    region: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isCartOpen) {
      if (cart.length === 0 && step !== 'confirmed') {
        setStep('cart');
      } else if (step !== 'confirmed') {
        setStep(initialCheckoutStep);
      }
    }
  }, [isCartOpen, initialCheckoutStep]);

  const deliveryFeeBase = Number(settings.delivery_fee || 8);
  const freeThreshold = Number(settings.free_delivery_threshold || 500);
  const deliveryFee = cartSubtotal >= freeThreshold || cartSubtotal === 0 ? 0 : deliveryFeeBase;
  const totalAmount = cartSubtotal + deliveryFee;

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.customer_name.trim()) nextErrors.customer_name = 'Nom et prénom requis.';
    if (!form.customer_phone.trim() || form.customer_phone.trim().length < 8) {
      nextErrors.customer_phone = 'Numéro de téléphone valide requis.';
    }
    if (!form.address.trim()) nextErrors.address = 'Adresse complète requise.';
    if (!form.city.trim()) nextErrors.city = 'Ville requise.';
    if (!form.region.trim()) nextErrors.region = 'Région / Gouvernorat requis.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleGoToReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      setStep('review');
    }
  };

  const handleConfirmOrder = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          items: cart.map((item) => ({
            product_id: item.product.id,
            quantity: item.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Erreur lors de la validation.', 'error');
        return;
      }
      setConfirmedOrder(data);
      clearCart();
      setStep('confirmed');
      showToast(`Commande ${data.order_number} confirmée.`, 'success');
    } catch {
      showToast('Impossible de contacter le serveur. Veuillez réessayer.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (step === 'confirmed') {
      setConfirmedOrder(null);
      setStep('cart');
    }
    closeCart();
  };

  return (
    <AnimatePresence>
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            className="fixed inset-0 bg-[#0B0B0C]/65 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 340 }}
            className="relative z-10 w-full max-w-lg bg-[#F7F5F0]/95 backdrop-blur-xl text-[#111113] h-full flex flex-col shadow-2xl border-l border-white/40"
          >
            {/* Header */}
            <div className="px-5 sm:px-6 py-4 bg-[#0B0B0C] text-[#F7F5F0] flex items-center justify-between border-b border-white/10">
              <div>
                <h2 className="font-serif text-xl font-semibold">
                  {step === 'cart' && 'Votre Panier'}
                  {step === 'checkout' && 'Livraison'}
                  {step === 'review' && 'Récapitulatif'}
                  {step === 'confirmed' && 'Commande Confirmée'}
                </h2>
                {step !== 'confirmed' && (
                  <p className="text-xs text-white/60 mt-0.5">Paiement à la livraison</p>
                )}
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Fermer le panier"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5">
              {step === 'cart' && (
                <>
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-12">
                      <ShoppingBag className="w-10 h-10 text-[#A6854E] mb-3 stroke-[1.25]" />
                      <p className="font-serif text-xl font-medium text-[#111113] mb-1">
                        Panier vide
                      </p>
                      <p className="text-xs text-[#6B665D]">
                        Sélectionnez votre garde-temps pour commencer.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {cartSubtotal < freeThreshold ? (
                        <div className="liquid-glass px-4 py-3 text-xs text-[#4A463F] flex items-center gap-2.5">
                          <Truck className="w-4 h-4 text-[#A6854E] shrink-0" />
                          <span>
                            Livraison offerte dès{' '}
                            <strong className="font-mono tabular-nums text-[#111113]">
                              {formatPrice(freeThreshold)}
                            </strong>
                          </span>
                        </div>
                      ) : (
                        <div className="bg-[#0B0B0C] text-[#C5A46D] px-4 py-2.5 text-xs flex items-center gap-2">
                          <Truck className="w-4 h-4 shrink-0" />
                          <span>Livraison offerte appliquée.</span>
                        </div>
                      )}

                      {cart.map((item) => {
                        const unit = item.product.promo_price ?? item.product.price;
                        return (
                          <div
                            key={item.product.id}
                            className="flex gap-4 bg-white/85 backdrop-blur-sm p-3.5 border border-[#E5E0D6]"
                          >
                            <div className="w-20 h-20 shrink-0 bg-[#EFECE4] overflow-hidden">
                              <ResilientImage
                                src={item.product.primary_image || item.product.images[0]}
                                alt={item.product.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col">
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="text-sm font-semibold text-[#111113] truncate">
                                  {item.product.name}
                                </h3>
                                <button
                                  type="button"
                                  onClick={() => removeFromCart(item.product.id)}
                                  aria-label="Retirer l'article"
                                  className="text-[#8A8479] hover:text-red-600 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              <span className="text-xs text-[#6B665D] font-mono tabular-nums mt-0.5">
                                {formatPrice(unit)}
                              </span>
                              <div className="mt-auto pt-2 flex items-center justify-between">
                                <div className="inline-flex items-center border border-[#E5E0D6] bg-white">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateCartQuantity(item.product.id, item.quantity - 1)
                                    }
                                    aria-label="Diminuer la quantité"
                                    className="min-w-[38px] min-h-[38px] flex items-center justify-center text-[#4A463F] hover:bg-[#F7F5F0] cursor-pointer"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="px-3 py-1 text-xs font-mono tabular-nums font-medium">
                                    {item.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={item.quantity >= item.product.stock_qty}
                                    onClick={() =>
                                      updateCartQuantity(item.product.id, item.quantity + 1)
                                    }
                                    aria-label="Augmenter la quantité"
                                    className="min-w-[38px] min-h-[38px] flex items-center justify-center text-[#4A463F] hover:bg-[#F7F5F0] disabled:opacity-40 cursor-pointer"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <span className="font-mono tabular-nums text-sm font-semibold text-[#111113]">
                                  {formatPrice(unit * item.quantity)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {step === 'checkout' && (
                <form id="checkout-form" onSubmit={handleGoToReview} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[#4A463F] mb-1">
                      Nom et prénom *
                    </label>
                    <input
                      type="text"
                      value={form.customer_name}
                      onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                      placeholder="Ex. Yassine Ben Salem"
                      className="w-full px-3.5 py-2.5 min-h-[44px] bg-white border border-[#D8D2C5] text-base sm:text-sm focus:outline-none focus:border-[#0B0B0C]"
                    />
                    {errors.customer_name && (
                      <p className="text-xs text-red-600 mt-1">{errors.customer_name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#4A463F] mb-1">
                      Numéro de téléphone *
                    </label>
                    <input
                      type="tel"
                      value={form.customer_phone}
                      onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                      placeholder="+216 XX XXX XXX"
                      className="w-full px-3.5 py-2.5 min-h-[44px] bg-white border border-[#D8D2C5] text-base sm:text-sm focus:outline-none focus:border-[#0B0B0C]"
                    />
                    {errors.customer_phone && (
                      <p className="text-xs text-red-600 mt-1">{errors.customer_phone}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#4A463F] mb-1">
                      Adresse complète *
                    </label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="Rue, numéro, appartement..."
                      className="w-full px-3.5 py-2.5 min-h-[44px] bg-white border border-[#D8D2C5] text-base sm:text-sm focus:outline-none focus:border-[#0B0B0C]"
                    />
                    {errors.address && (
                      <p className="text-xs text-red-600 mt-1">{errors.address}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#4A463F] mb-1">
                        Ville *
                      </label>
                      <input
                        type="text"
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                        placeholder="Zaghouan"
                        className="w-full px-3.5 py-2.5 min-h-[44px] bg-white border border-[#D8D2C5] text-base sm:text-sm focus:outline-none focus:border-[#0B0B0C]"
                      />
                      {errors.city && <p className="text-xs text-red-600 mt-1">{errors.city}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#4A463F] mb-1">
                        Région *
                      </label>
                      <input
                        type="text"
                        value={form.region}
                        onChange={(e) => setForm({ ...form, region: e.target.value })}
                        placeholder="Zaghouan / Tunis"
                        className="w-full px-3.5 py-2.5 min-h-[44px] bg-white border border-[#D8D2C5] text-base sm:text-sm focus:outline-none focus:border-[#0B0B0C]"
                      />
                      {errors.region && (
                        <p className="text-xs text-red-600 mt-1">{errors.region}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#4A463F] mb-1">
                      Remarque supplémentaire (facultative)
                    </label>
                    <textarea
                      rows={2}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="Instructions, emballage cadeau..."
                      className="w-full px-3.5 py-2.5 bg-white border border-[#D8D2C5] text-base sm:text-sm focus:outline-none focus:border-[#0B0B0C]"
                    />
                  </div>

                  <div className="bg-white border border-[#C5A46D]/60 p-3.5">
                    <p className="text-xs font-semibold text-[#111113]">
                      Paiement à la livraison
                    </p>
                    <p className="text-xs text-[#6B665D] mt-0.5">
                      Règlement en espèces à la réception de votre colis.
                    </p>
                  </div>
                </form>
              )}

              {step === 'review' && (
                <div className="space-y-5">
                  <div className="bg-white border border-[#E5E0D6] p-4 space-y-1.5 text-sm">
                    <h3 className="text-xs font-semibold text-[#6B665D] tracking-wide">
                      Destinataire
                    </h3>
                    <p className="font-semibold text-[#111113]">{form.customer_name}</p>
                    <p className="text-[#4A463F] font-mono text-xs">{form.customer_phone}</p>
                    <p className="text-[#4A463F]">
                      {form.address}, {form.city}, {form.region}
                    </p>
                    {form.notes && (
                      <p className="text-xs text-[#6B665D] italic pt-1 border-t border-[#F0ECE3]">
                        {form.notes}
                      </p>
                    )}
                  </div>

                  <div className="bg-white border border-[#E5E0D6] p-4 space-y-3">
                    <h3 className="text-xs font-semibold text-[#6B665D] tracking-wide">
                      Articles
                    </h3>
                    {cart.map((item) => {
                      const unit = item.product.promo_price ?? item.product.price;
                      return (
                        <div key={item.product.id} className="flex justify-between text-sm gap-3">
                          <span className="text-[#111113]">
                            {item.quantity} × {item.product.name}
                          </span>
                          <span className="font-mono tabular-nums font-medium shrink-0">
                            {formatPrice(unit * item.quantity)}
                          </span>
                        </div>
                      );
                    })}
                    <div className="pt-3 border-t border-[#F0ECE3] space-y-1.5 text-sm">
                      <div className="flex justify-between text-[#6B665D]">
                        <span>Livraison</span>
                        <span className="font-mono tabular-nums">
                          {deliveryFee === 0 ? 'Offerte' : formatPrice(deliveryFee)}
                        </span>
                      </div>
                      <div className="flex justify-between font-semibold text-base text-[#111113] pt-1">
                        <span>Total</span>
                        <span className="font-mono tabular-nums">{formatPrice(totalAmount)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 'confirmed' && confirmedOrder && (
                <div className="py-6 space-y-5">
                  <div className="bg-[#0B0B0C] text-[#F7F5F0] p-6 border border-[#C5A46D]/40 text-center">
                    <CheckCircle2 className="w-10 h-10 text-[#C5A46D] mx-auto mb-3 stroke-[1.5]" />
                    <h3 className="font-serif text-2xl font-semibold mb-3">
                      Commande enregistrée
                    </h3>
                    <div className="inline-block bg-white/10 border border-[#C5A46D]/40 px-4 py-2 font-mono text-base font-semibold text-[#C5A46D] tabular-nums">
                      {confirmedOrder.order_number}
                    </div>
                  </div>

                  <div className="bg-white border border-[#E5E0D6] p-4 space-y-2 text-sm">
                    <p className="font-semibold text-[#111113]">{confirmedOrder.customer_name}</p>
                    <p className="text-xs text-[#4A463F] font-mono">
                      {confirmedOrder.customer_phone}
                    </p>
                    <p className="text-xs text-[#4A463F]">
                      {confirmedOrder.address}, {confirmedOrder.city}, {confirmedOrder.region}
                    </p>
                    <div className="pt-2 border-t border-[#F0ECE3] flex justify-between font-semibold">
                      <span>Total ({confirmedOrder.payment_method})</span>
                      <span className="font-mono tabular-nums">
                        {formatPrice(confirmedOrder.total_amount)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 sm:px-6 pt-4 pb-safe bg-white/90 border-t border-[#E5E0D6]">
              {step === 'cart' && cart.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#6B665D]">Sous-total</span>
                    <span className="font-mono tabular-nums font-semibold text-base text-[#111113]">
                      {formatPrice(cartSubtotal)}
                    </span>
                  </div>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setStep('checkout')}
                    className="btn-sheen w-full py-3 px-4 bg-[#0B0B0C] text-[#F7F5F0] text-sm font-medium hover:bg-[#1E1E22] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Commander</span>
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </div>
              )}

              {step === 'checkout' && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setStep('cart')}
                    className="px-4 py-3 border border-[#D8D2C5] text-sm font-medium text-[#111113] hover:bg-[#F7F5F0] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Retour</span>
                  </button>
                  <motion.button
                    type="submit"
                    whileTap={{ scale: 0.98 }}
                    form="checkout-form"
                    className="btn-sheen flex-1 py-3 px-4 bg-[#0B0B0C] text-[#F7F5F0] text-sm font-medium hover:bg-[#1E1E22] inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Récapitulatif</span>
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </div>
              )}

              {step === 'review' && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setStep('checkout')}
                    className="px-4 py-3 border border-[#D8D2C5] text-sm font-medium text-[#111113] hover:bg-[#F7F5F0] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Modifier</span>
                  </button>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    disabled={submitting}
                    onClick={handleConfirmOrder}
                    className="btn-sheen flex-1 py-3 px-4 bg-[#C5A46D] text-[#0B0B0C] text-sm font-semibold hover:bg-[#D4B680] disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    {submitting ? 'Validation...' : 'Confirmer la commande'}
                  </motion.button>
                </div>
              )}

              {step === 'confirmed' && (
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full py-3 px-4 bg-[#0B0B0C] text-[#F7F5F0] text-sm font-medium hover:bg-[#1E1E22] cursor-pointer"
                >
                  Continuer
                </button>
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

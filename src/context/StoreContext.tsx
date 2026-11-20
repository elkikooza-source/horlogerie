import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { BusinessSettings, CartItem, Category, Product } from '../types';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface StoreContextType {
  settings: BusinessSettings;
  categories: Category[];
  loadingSettings: boolean;
  refreshSettings: () => Promise<void>;
  cart: CartItem[];
  cartCount: number;
  cartSubtotal: number;
  isCartOpen: boolean;
  initialCheckoutStep: 'cart' | 'checkout';
  openCart: (step?: 'cart' | 'checkout') => void;
  closeCart: () => void;
  addToCart: (product: Product, quantity?: number, openCheckoutImmediately?: boolean) => void;
  removeFromCart: (productId: number) => void;
  updateCartQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  formatPrice: (amount: number) => string;
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;
}

const DEFAULT_SETTINGS: BusinessSettings = {
  brand_name: 'Horlogerie Zeina',
  logo_url: '',
  hero_slogan: 'Pas besoin de courir après le temps… laissez-nous nous en occuper',
  hero_subtitle:
    'Garde-temps de caractère pour hommes et femmes, bracelets sur mesure et atelier de haute réparation horlogère au cœur de Zaghouan.',
  hero_image: '/src/assets/images/hero_luxury_watch_1795182946775.jpg',
  repair_banner_image: '/src/assets/images/atelier_watchmaker_repair_1795182913427.jpg',
  repair_title: 'Votre montre mérite une seconde vie',
  repair_description:
    'Révision complète de mouvements automatiques et mécaniques, remplacement de pile et test d’étanchéité, polissage artisanal et restauration de pièces de famille.',
  about_title: 'L’Exigence Horlogère à Zaghouan',
  about_text:
    'Horlogerie Zeina incarne la rencontre entre la tradition horlogère de précision et le service de proximité.',
  phone: '+216 56 375 456',
  email: 'contact@horlogeriezeina.tn',
  address: 'C44R+GXM, Rue Kanalou, Zaghouan, Tunisie',
  google_maps_url:
    'https://www.google.com/maps/search/?api=1&query=C44R%2BGXM,+Rue+Kanalou,+Zaghouan,+Tunisie',
  instagram_url: 'https://www.instagram.com/horlogerie_zeina/',
  facebook_url: 'https://www.facebook.com/p/Zeina-61556602533155/',
  whatsapp_number: '+216 56 375 456',
  currency: 'TND',
  delivery_fee: '8',
  free_delivery_threshold: '500',
};

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'maison_kanalou_cart_v1';

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [initialCheckoutStep, setInitialCheckoutStep] = useState<'cart' | 'checkout'>('cart');
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'success') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      const [settingsRes, catRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/categories'),
      ]);
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings((prev) => ({ ...prev, ...data }));
      }
      if (catRes.ok) {
        setCategories(await catRes.json());
      }
    } catch {
      // Fallback to defaults silently
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // ignore storage errors
    }
  }, [cart]);

  const openCart = useCallback((step: 'cart' | 'checkout' = 'cart') => {
    setInitialCheckoutStep(step);
    setIsCartOpen(true);
  }, []);

  const closeCart = useCallback(() => {
    setIsCartOpen(false);
  }, []);

  const addToCart = useCallback(
    (product: Product, quantity = 1, openCheckoutImmediately = false) => {
      if (product.stock_qty <= 0) {
        showToast('Ce modèle est actuellement en rupture de stock.', 'error');
        return;
      }

      setCart((prev) => {
        const existing = prev.find((item) => item.product.id === product.id);
        if (existing) {
          const nextQty = Math.min(product.stock_qty, existing.quantity + quantity);
          if (nextQty === existing.quantity) {
            showToast(`Stock maximum atteint (${product.stock_qty}) pour ce modèle.`, 'info');
            return prev;
          }
          return prev.map((item) =>
            item.product.id === product.id ? { ...item, product, quantity: nextQty } : item
          );
        }
        return [...prev, { product, quantity: Math.min(product.stock_qty, quantity) }];
      });

      if (openCheckoutImmediately) {
        setInitialCheckoutStep('checkout');
        setIsCartOpen(true);
      } else {
        showToast(`« ${product.name} » ajouté au panier.`, 'success');
      }
    },
    [showToast]
  );

  const removeFromCart = useCallback((productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  }, []);

  const updateCartQuantity = useCallback((productId: number, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((item) => item.product.id !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, quantity: Math.min(item.product.stock_qty, quantity) }
          : item
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const cartSubtotal = cart.reduce((acc, item) => {
    const unit = item.product.promo_price ?? item.product.price;
    return acc + unit * item.quantity;
  }, 0);

  const formatPrice = useCallback(
    (amount: number) => {
      const currency = settings.currency || 'TND';
      return `${Number(amount).toLocaleString('fr-FR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })} ${currency}`;
    },
    [settings.currency]
  );

  return (
    <StoreContext.Provider
      value={{
        settings,
        categories,
        loadingSettings,
        refreshSettings,
        cart,
        cartCount,
        cartSubtotal,
        isCartOpen,
        initialCheckoutStep,
        openCart,
        closeCart,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        formatPrice,
        toasts,
        showToast,
        dismissToast,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

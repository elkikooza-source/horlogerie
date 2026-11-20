import React from 'react';
import { Link } from 'react-router-dom';
import { Phone, MapPin, Mail, Instagram, Facebook, ExternalLink } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export function Footer() {
  const { settings } = useStore();
  const cleanPhone = (settings.phone || '+216 56 375 456').replace(/\s+/g, '');

  return (
    <footer className="bg-[#0A0A0B] text-[#F5F2EB] border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand Column */}
          <div>
            <h3 className="font-serif text-2xl font-medium text-[#F5F2EB] mb-3">
              {settings.brand_name || 'Horlogerie Zeina'}
            </h3>
            <p className="text-xs text-[#F5F2EB]/60 leading-relaxed mb-5">
              {settings.hero_slogan}
            </p>
            <div className="flex items-center gap-3">
              {settings.instagram_url && (
                <a
                  href={settings.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="p-2 border border-white/15 text-[#F5F2EB]/70 hover:text-[#C4A773] hover:border-[#C4A773]/60 transition-colors"
                >
                  <Instagram className="w-4 h-4" />
                </a>
              )}
              {settings.facebook_url && (
                <a
                  href={settings.facebook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="p-2 border border-white/15 text-[#F5F2EB]/70 hover:text-[#C4A773] hover:border-[#C4A773]/60 transition-colors"
                >
                  <Facebook className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-[11px] font-semibold tracking-[0.18em] text-[#C4A773] mb-4">
              COLLECTIONS
            </h4>
            <ul className="space-y-2.5 text-sm text-[#F5F2EB]/70">
              <li>
                <Link to="/boutique" className="hover:text-[#F5F2EB] transition-colors">
                  Toute la boutique
                </Link>
              </li>
              <li>
                <Link to="/boutique?category=hommes" className="hover:text-[#F5F2EB] transition-colors">
                  Montres pour hommes
                </Link>
              </li>
              <li>
                <Link to="/boutique?category=femmes" className="hover:text-[#F5F2EB] transition-colors">
                  Montres pour femmes
                </Link>
              </li>
              <li>
                <Link
                  to="/boutique?category=accessoires"
                  className="hover:text-[#F5F2EB] transition-colors"
                >
                  Bracelets & accessoires
                </Link>
              </li>
            </ul>
          </div>

          {/* Atelier */}
          <div>
            <h4 className="text-[11px] font-semibold tracking-[0.18em] text-[#C4A773] mb-4">
              ATELIER & SERVICES
            </h4>
            <ul className="space-y-2.5 text-sm text-[#F5F2EB]/70">
              <li>
                <Link to="/reparation" className="hover:text-[#F5F2EB] transition-colors">
                  Réparation & restauration
                </Link>
              </li>
              <li>
                <Link to="/reparation" className="hover:text-[#F5F2EB] transition-colors">
                  Prendre rendez-vous
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-[#F5F2EB] transition-colors">
                  Nous trouver
                </Link>
              </li>
              <li>
                <Link to="/admin" className="text-[#F5F2EB]/45 hover:text-[#C4A773] transition-colors">
                  Administration
                </Link>
              </li>
            </ul>
          </div>

          {/* Coordinates */}
          <div>
            <h4 className="text-[11px] font-semibold tracking-[0.18em] text-[#C4A773] mb-4">
              COORDONNÉES
            </h4>
            <ul className="space-y-3 text-sm text-[#F5F2EB]/70">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#C4A773] shrink-0 mt-0.5" />
                <span>{settings.address}</span>
              </li>
              <li>
                <a
                  href={`tel:${cleanPhone}`}
                  className="flex items-center gap-2.5 hover:text-[#C4A773] transition-colors font-mono"
                >
                  <Phone className="w-4 h-4 text-[#C4A773] shrink-0" />
                  <span>{settings.phone}</span>
                </a>
              </li>
              {settings.email && (
                <li>
                  <a
                    href={`mailto:${settings.email}`}
                    className="flex items-center gap-2.5 hover:text-[#C4A773] transition-colors"
                  >
                    <Mail className="w-4 h-4 text-[#C4A773] shrink-0" />
                    <span>{settings.email}</span>
                  </a>
                </li>
              )}
              <li className="pt-1">
                <a
                  href={settings.google_maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#C4A773] hover:underline"
                >
                  <span>Nous trouver sur Google Maps</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#F5F2EB]/45">
          <p>
            © {new Date().getFullYear()} {settings.brand_name || 'Horlogerie Zeina'}. Tous droits
            réservés.
          </p>
          <p>Paiement à la livraison · Zaghouan</p>
        </div>
      </div>
    </footer>
  );
}

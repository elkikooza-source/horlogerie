import React from 'react';
import { MapPin, Phone, Clock, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';
import { useStore } from '../context/StoreContext';

export function LocationSection() {
  const { settings } = useStore();
  const cleanPhone = (settings.phone || '+216 56 375 456').replace(/\s+/g, '');
  const mapQuery = encodeURIComponent(
    settings.address || 'C44R+GXM, Rue Kanalou, Zaghouan, Tunisie'
  );
  const embedUrl = `https://maps.google.com/maps?q=${mapQuery}&t=&z=16&ie=UTF8&iwloc=&output=embed`;

  return (
    <section id="contact" className="py-16 bg-[#F5F2EB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left: Info */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45 }}
            className="lg:col-span-5 flex flex-col justify-between bg-[#FAF8F4] border border-[#0A0A0B]/10 p-8"
          >
            <div>
              <p className="text-[11px] font-medium tracking-[0.22em] text-[#85693A] mb-2">
                BOUTIQUE & ATELIER
              </p>
              <h2 className="font-serif text-3xl font-medium text-[#0A0A0B] mb-6">
                Nous trouver à Zaghouan
              </h2>

              <div className="space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-[#85693A] shrink-0 mt-1" />
                  <p className="text-[#4A453C]">{settings.address}</p>
                </div>

                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-[#85693A] shrink-0" />
                  <a
                    href={`tel:${cleanPhone}`}
                    className="font-mono text-[#0A0A0B] hover:text-[#85693A] transition-colors underline underline-offset-4 decoration-[#C4A773]/60"
                  >
                    {settings.phone}
                  </a>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-[#85693A] shrink-0 mt-1" />
                  <p className="text-[#5A5449] text-xs leading-relaxed">
                    Lun – Ven : 09h00 – 18h00 · Sam : 09h00 – 16h00
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-[#0A0A0B]/8 flex flex-wrap gap-3">
              <motion.a
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                href={settings.google_maps_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-sheen inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#0A0A0B] text-[#F5F2EB] text-xs font-medium tracking-wider hover:bg-[#1C1C20] transition-colors whitespace-nowrap"
              >
                <span>Nous trouver sur Google Maps</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#C4A773]" />
              </motion.a>
              <motion.a
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                href={`tel:${cleanPhone}`}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 border border-[#0A0A0B]/20 text-[#0A0A0B] text-xs font-medium tracking-wider hover:border-[#0A0A0B] transition-colors whitespace-nowrap"
              >
                <Phone className="w-3.5 h-3.5 text-[#85693A]" />
                <span>Appeler</span>
              </motion.a>
            </div>
          </motion.div>

          {/* Right: Interactive Google Maps Embed + Liquid Glass Floating Label */}
          <div className="lg:col-span-7 min-h-[360px] lg:min-h-[420px] bg-[#EAE5DA] border border-[#0A0A0B]/10 overflow-hidden relative">
            <iframe
              title="Localisation Horlogerie Zeina Zaghouan"
              src={embedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="w-full h-full min-h-[360px] border-0"
              allowFullScreen
            />
            <div className="liquid-glass pointer-events-none hidden sm:flex items-center gap-2.5 px-4 py-2.5 absolute bottom-4 left-4 text-xs font-medium text-[#0A0A0B]">
              <MapPin className="w-3.5 h-3.5 text-[#85693A]" />
              <span>{settings.address}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

import React from 'react';
import { LocationSection } from '../components/LocationSection';

export function ContactPage() {
  return (
    <div>
      <section className="bg-[#0B0B0C] text-[#F7F5F0] py-14 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-medium tracking-[0.2em] text-[#C5A46D] mb-2">
            CONTACT & LOCALISATION
          </p>
          <h1 className="font-serif text-3xl sm:text-5xl font-semibold">
            Rencontrer nos horlogers
          </h1>
          <p className="text-sm text-white/70 mt-2 max-w-xl">
            Retrouvez notre boutique et atelier de réparation à Zaghouan, ou contactez-nous
            directement par téléphone.
          </p>
        </div>
      </section>

      <LocationSection />
    </div>
  );
}

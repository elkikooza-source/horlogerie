import React from 'react';
import { Wrench, Droplets, Sparkles, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { useStore } from '../context/StoreContext';
import { ResilientImage } from '../components/ResilientImage';
import { RepairBookingWidget } from '../components/RepairBookingWidget';

export function RepairPage() {
  const { settings } = useStore();

  const services = [
    {
      icon: Clock,
      title: 'Révision & Calibrage Mécanique',
      desc: 'Démontage intégral du calibre, nettoyage aux ultrasons, huilage horloger et réglage chronométrique de précision.',
    },
    {
      icon: Droplets,
      title: 'Changement de Pile & Étanchéité',
      desc: 'Remplacement par pile suisse haute capacité, contrôle des joints et test sous pression.',
    },
    {
      icon: Sparkles,
      title: 'Polissage Boîtier & Bracelet',
      desc: 'Ravivage satiné et poli miroir respectant les arêtes d’origine de l’acier ou de l’or.',
    },
    {
      icon: Wrench,
      title: 'Restauration & Verre Saphir',
      desc: 'Remplacement de verre, couronne, tige de remontoir et restauration complète de montres anciennes.',
    },
  ];

  return (
    <div className="bg-[#F5F2EB]">
      {/* Hero Banner */}
      <section className="relative bg-[#0A0A0B] text-[#F5F2EB] overflow-hidden border-b border-white/10">
        <div className="absolute inset-0">
          <ResilientImage
            src={settings.repair_banner_image}
            alt="Atelier de réparation horlogère"
            dark
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0C] via-[#0B0B0C]/70 to-[#0B0B0C]/60" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-medium tracking-[0.2em] text-[#C5A46D] mb-3">
              ATELIER HORLOGER · ZAGHOUAN
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl font-semibold leading-tight text-balance mb-4">
              {settings.repair_title || 'Votre montre mérite une seconde vie'}
            </h1>
            <p className="text-sm sm:text-base text-white/80 leading-relaxed">
              {settings.repair_description}
            </p>
          </div>
        </div>
      </section>

      {/* Services Breakdown */}
      <section className="py-12 border-b border-[#0A0A0B]/8 bg-[#F5F2EB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {services.map((srv, idx) => {
              const Icon = srv.icon;
              return (
                <motion.div
                  key={srv.title}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.35, delay: idx * 0.06 }}
                  className="liquid-glass p-5"
                >
                  <Icon className="w-5 h-5 text-[#85693A] mb-2.5 stroke-[1.4]" />
                  <h2 className="text-sm font-semibold text-[#0A0A0B] mb-1">{srv.title}</h2>
                  <p className="text-xs text-[#5A5449] line-clamp-2">{srv.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Interactive Booking System */}
      <section className="py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-xl mb-7">
            <p className="text-xs font-medium tracking-[0.18em] text-[#A6854E] mb-1.5">
              RENDEZ-VOUS EN LIGNE
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-[#111113]">
              Choisissez votre créneau
            </h2>
          </div>

          <RepairBookingWidget />
        </div>
      </section>
    </div>
  );
}

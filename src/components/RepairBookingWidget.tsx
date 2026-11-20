import React, { useEffect, useState, useCallback } from 'react';
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, CheckCircle2, Wrench } from 'lucide-react';
import { Appointment, WatchType } from '../types';
import { useStore } from '../context/StoreContext';

const MONTH_NAMES = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const WATCH_TYPES: WatchType[] = [
  'Montre classique',
  'Montre automatique',
  'Montre connectée',
  'Autre',
];

interface DayAvailabilitySummary {
  availableCount: number;
  isWorkingDay: boolean;
  isBlockedDay: boolean;
  isPast: boolean;
}

export function RepairBookingWidget() {
  const { showToast } = useStore();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth()); // 0-indexed
  const [monthData, setMonthData] = useState<Record<string, DayAvailabilitySummary>>({});
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmedAppt, setConfirmedAppt] = useState<Appointment | null>(null);

  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    watch_type: 'Montre automatique' as WatchType,
    problem_description: '',
  });
  const [formError, setFormError] = useState('');

  const monthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;

  const fetchMonthAvailability = useCallback(async () => {
    try {
      const res = await fetch(`/api/appointments/month-availability?month=${monthKey}`);
      if (res.ok) {
        const data = await res.json();
        setMonthData(data);
      }
    } catch {
      // silent
    }
  }, [monthKey]);

  useEffect(() => {
    fetchMonthAvailability();
  }, [fetchMonthAvailability]);

  const fetchDaySlots = useCallback(async (dateStr: string) => {
    setLoadingSlots(true);
    setSelectedTime('');
    try {
      const res = await fetch(`/api/appointments/availability?date=${dateStr}`);
      if (res.ok) {
        const data = await res.json();
        setAvailableSlots(data.slots || []);
      }
    } catch {
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  const handleSelectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    setConfirmedAppt(null);
    fetchDaySlots(dateStr);
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedDate || !selectedTime) {
      setFormError('Veuillez sélectionner une date et un créneau horaire disponible.');
      return;
    }
    if (!form.customer_name.trim() || !form.customer_phone.trim()) {
      setFormError('Veuillez renseigner votre nom complet et votre numéro de téléphone.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          appointment_date: selectedDate,
          appointment_time: selectedTime,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Ce créneau n’est plus disponible.');
        showToast(data.error || 'Créneau indisponible.', 'error');
        await fetchDaySlots(selectedDate);
        await fetchMonthAvailability();
        return;
      }

      setConfirmedAppt(data);
      showToast('Votre rendez-vous horloger est confirmé.', 'success');
      setForm({
        customer_name: '',
        customer_phone: '',
        watch_type: 'Montre automatique',
        problem_description: '',
      });
      await fetchDaySlots(selectedDate);
      await fetchMonthAvailability();
    } catch {
      setFormError('Erreur réseau lors de la réservation. Veuillez réessayer.');
    } finally {
      setSubmitting(false);
    }
  };

  // Calendar grid geometry (Monday-first)
  const firstDayJs = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun..6=Sat
  const offset = firstDayJs === 0 ? 6 : firstDayJs - 1;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const formatDateFrench = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
  };

  return (
    <div className="bg-white border border-[#E5E0D6] shadow-xs">
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Step 1 & 2: Interactive Calendar + Time Slots */}
        <div className="lg:col-span-7 p-6 sm:p-8 border-b lg:border-b-0 lg:border-r border-[#E5E0D6]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs font-medium text-[#A6854E] tracking-wider">
                ÉTAPE 1 · DATE & CRÉNEAU
              </p>
              <h3 className="font-serif text-2xl font-semibold text-[#111113] mt-0.5">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Mois précédent"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center border border-[#E5E0D6] hover:border-[#0B0B0C] transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Mois suivant"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center border border-[#E5E0D6] hover:border-[#0B0B0C] transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1.5 mb-2 text-center">
            {WEEKDAYS.map((wd) => (
              <div key={wd} className="text-[11px] font-semibold text-[#6B665D] py-1">
                {wd}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: offset }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-11" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateStr = `${monthKey}-${String(dayNum).padStart(2, '0')}`;
              const info = monthData[dateStr];
              const isAvailable =
                info && !info.isPast && info.isWorkingDay && !info.isBlockedDay && info.availableCount > 0;
              const isSelected = selectedDate === dateStr;

              return (
                <button
                  key={dateStr}
                  type="button"
                  disabled={!isAvailable}
                  onClick={() => handleSelectDate(dateStr)}
                  className={`h-11 flex flex-col items-center justify-center text-sm font-mono tabular-nums transition-all border ${
                    isSelected
                      ? 'bg-[#0B0B0C] text-[#C5A46D] border-[#0B0B0C] font-semibold cursor-pointer'
                      : isAvailable
                      ? 'bg-[#F7F5F0] text-[#111113] border-[#E5E0D6] hover:border-[#C5A46D] hover:bg-[#EFECE4] cursor-pointer'
                      : 'bg-transparent text-[#B8B2A6] border-transparent cursor-not-allowed line-through'
                  }`}
                >
                  <span>{dayNum}</span>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-5 mt-5 pt-4 border-t border-[#F0ECE3] text-xs text-[#6B665D]">
            <span className="inline-flex items-center gap-2">
              <span className="w-3 h-3 bg-[#F7F5F0] border border-[#E5E0D6]" />
              Disponible
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-3 h-3 bg-[#0B0B0C]" />
              Sélectionné
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-3 h-3 border border-[#E5E0D6] opacity-40" />
              Fermé ou complet
            </span>
          </div>

          {/* Free Time Slots */}
          <div className="mt-7">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#4A463F] mb-3">
              <Clock className="w-4 h-4 text-[#A6854E]" />
              <span>
                {selectedDate
                  ? `Créneaux libres le ${formatDateFrench(selectedDate)}`
                  : 'Sélectionnez une date pour voir les créneaux disponibles'}
              </span>
            </div>

            {selectedDate && (
              <>
                {loadingSlots ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className="h-10 bg-[#EFECE4] animate-pulse" />
                    ))}
                  </div>
                ) : availableSlots.length === 0 ? (
                  <p className="text-sm text-[#6B665D] bg-[#F7F5F0] px-4 py-3 border border-[#E5E0D6]">
                    Aucun créneau libre à cette date. Veuillez choisir un autre jour.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-2">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedTime(slot)}
                        className={`min-h-[44px] py-2.5 px-3 text-sm font-mono tabular-nums border transition-colors cursor-pointer ${
                          selectedTime === slot
                            ? 'bg-[#C5A46D] text-[#0B0B0C] border-[#C5A46D] font-semibold'
                            : 'bg-white text-[#111113] border-[#D8D2C5] hover:border-[#0B0B0C]'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Step 3: Form or Confirmation */}
        <div className="lg:col-span-5 p-6 sm:p-8 bg-[#FAF8F4]">
          {confirmedAppt ? (
            <div className="h-full flex flex-col justify-center">
              <div className="bg-[#0B0B0C] text-[#F7F5F0] p-6 border border-[#C5A46D]/40 space-y-4">
                <CheckCircle2 className="w-9 h-9 text-[#C5A46D] stroke-[1.5]" />
                <div>
                  <p className="text-xs text-[#C5A46D] tracking-widest mb-1">
                    RENDEZ-VOUS ENREGISTRÉ
                  </p>
                  <h4 className="font-serif text-2xl font-semibold">
                    À très bientôt à l’atelier
                  </h4>
                </div>
                <div className="py-3 border-y border-white/15 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/65">Référence</span>
                    <span className="font-mono text-[#C5A46D] font-semibold">
                      {confirmedAppt.reference_code}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/65">Date</span>
                    <span className="font-mono">
                      {formatDateFrench(confirmedAppt.appointment_date)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/65">Horaire</span>
                    <span className="font-mono">{confirmedAppt.appointment_time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/65">Montre</span>
                    <span>{confirmedAppt.watch_type}</span>
                  </div>
                </div>
                <p className="text-xs text-white/70">
                  Atelier Horlogerie Zeina — C44R+GXM, Rue Kanalou, Zaghouan.
                </p>
                <button
                  type="button"
                  onClick={() => setConfirmedAppt(null)}
                  className="w-full py-2.5 px-4 border border-[#C5A46D] text-[#C5A46D] text-xs font-medium hover:bg-[#C5A46D] hover:text-[#0B0B0C] transition-colors cursor-pointer"
                >
                  Prendre un autre rendez-vous
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <p className="text-xs font-medium text-[#A6854E] tracking-wider">
                  ÉTAPE 2 · VOS INFORMATIONS
                </p>
                <h3 className="font-serif text-2xl font-semibold text-[#111113] mt-0.5">
                  Confirmer votre passage
                </h3>
              </div>

              {selectedDate && selectedTime ? (
                <div className="bg-[#0B0B0C] text-[#F7F5F0] px-4 py-3 text-xs flex items-center justify-between">
                  <span className="inline-flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-[#C5A46D]" />
                    <span>{formatDateFrench(selectedDate)}</span>
                  </span>
                  <span className="font-mono font-semibold text-[#C5A46D]">{selectedTime}</span>
                </div>
              ) : (
                <div className="bg-white border border-[#E5E0D6] px-4 py-3 text-xs text-[#6B665D]">
                  Veuillez d’abord choisir une date et un horaire dans le calendrier.
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#4A463F] mb-1">
                  Nom et prénom *
                </label>
                <input
                  type="text"
                  required
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  placeholder="Ex. Amira Trabelsi"
                  className="w-full px-3.5 py-2.5 min-h-[44px] bg-white border border-[#D8D2C5] text-base sm:text-sm focus:outline-none focus:border-[#0B0B0C]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4A463F] mb-1">
                  Numéro de téléphone *
                </label>
                <input
                  type="tel"
                  required
                  value={form.customer_phone}
                  onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                  placeholder="+216 XX XXX XXX"
                  className="w-full px-3.5 py-2.5 min-h-[44px] bg-white border border-[#D8D2C5] text-base sm:text-sm focus:outline-none focus:border-[#0B0B0C]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4A463F] mb-1">
                  Type de montre *
                </label>
                <select
                  value={form.watch_type}
                  onChange={(e) => setForm({ ...form, watch_type: e.target.value as WatchType })}
                  className="w-full px-3.5 py-2.5 min-h-[44px] bg-white border border-[#D8D2C5] text-base sm:text-sm focus:outline-none focus:border-[#0B0B0C]"
                >
                  {WATCH_TYPES.map((wt) => (
                    <option key={wt} value={wt}>
                      {wt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4A463F] mb-1">
                  Description du problème (facultative)
                </label>
                <textarea
                  rows={3}
                  value={form.problem_description}
                  onChange={(e) => setForm({ ...form, problem_description: e.target.value })}
                  placeholder="Ex. Retard de quelques minutes par jour, changement de pile, verre rayé..."
                  className="w-full px-3.5 py-2.5 bg-white border border-[#D8D2C5] text-base sm:text-sm focus:outline-none focus:border-[#0B0B0C]"
                />
              </div>

              {formError && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2">
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || !selectedDate || !selectedTime}
                className="w-full py-3 min-h-[44px] px-4 bg-[#0B0B0C] text-[#F7F5F0] text-sm font-medium hover:bg-[#1E1E22] disabled:opacity-45 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Wrench className="w-4 h-4 text-[#C5A46D]" />
                <span>
                  {submitting ? 'Confirmation en cours...' : 'Confirmer mon rendez-vous'}
                </span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

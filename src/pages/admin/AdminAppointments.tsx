import React, { useEffect, useState, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Lock,
  Trash2,
  X,
  Check,
  Ban,
} from 'lucide-react';
import { Appointment, AppointmentStatus, BlockedSlot, WatchType, WorkingSchedule } from '../../types';
import { useStore } from '../../context/StoreContext';

interface AdminAppointmentsProps {
  token: string;
}

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
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

const STATUS_MAP: Record<AppointmentStatus, { label: string; cls: string }> = {
  en_attente: { label: 'En attente', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  confirme: { label: 'Confirmé', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  termine: { label: 'Terminé', cls: 'bg-neutral-100 text-neutral-700 border-neutral-300' },
  annule: { label: 'Annulé', cls: 'bg-red-50 text-red-700 border-red-200' },
};

function toYMD(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function AdminAppointments({ token }: AdminAppointmentsProps) {
  const { showToast } = useStore();
  const [subTab, setSubTab] = useState<'calendar' | 'availability'>('calendar');
  const [calView, setCalView] = useState<'day' | 'week' | 'month'>('month');
  const [focusDate, setFocusDate] = useState(() => new Date());

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [schedules, setSchedules] = useState<WorkingSchedule[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const [manualModal, setManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    customer_name: '',
    customer_phone: '',
    watch_type: 'Montre automatique' as WatchType,
    problem_description: '',
    appointment_date: toYMD(new Date()),
    appointment_time: '10:00',
    status: 'confirme' as AppointmentStatus,
  });

  const [blockForm, setBlockForm] = useState({
    specific_date: toYMD(new Date()),
    start_time: '',
    reason: 'Fermeture atelier',
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [apptRes, availRes] = await Promise.all([
        fetch('/api/admin/appointments', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/availability', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (apptRes.ok) setAppointments(await apptRes.json());
      if (availRes.ok) {
        const data = await availRes.json();
        setSchedules(data.schedules || []);
        setBlockedSlots(data.blocked || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openApptDetail = (a: Appointment) => {
    setSelectedAppt(a);
    setEditDate(a.appointment_date);
    setEditTime(a.appointment_time);
    setEditNotes(a.admin_notes || '');
  };

  const updateAppt = async (id: number, patch: Partial<Appointment>) => {
    const res = await fetch(`/api/admin/appointments/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Erreur lors de la mise à jour.', 'error');
      return;
    }
    showToast('Rendez-vous mis à jour.', 'success');
    setSelectedAppt(data);
    loadAll();
  };

  const handleManualCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/appointments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(manualForm),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Créneau déjà occupé.', 'error');
      return;
    }
    showToast('Rendez-vous ajouté manuellement.', 'success');
    setManualModal(false);
    loadAll();
  };

  const handleSaveSchedule = async () => {
    const res = await fetch('/api/admin/availability/schedule', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ schedules }),
    });
    if (res.ok) {
      showToast('Horaires d’ouverture mis à jour.', 'success');
      loadAll();
    }
  };

  const handleBlockSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/availability/block', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(blockForm),
    });
    if (res.ok) {
      showToast('Créneau bloqué sur le calendrier public.', 'success');
      loadAll();
    }
  };

  const handleUnblock = async (id: number) => {
    const res = await fetch(`/api/admin/availability/block/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      showToast('Blocage supprimé.', 'info');
      loadAll();
    }
  };

  // Calendar navigation helpers
  const shiftFocus = (dir: -1 | 1) => {
    const next = new Date(focusDate);
    if (calView === 'day') next.setDate(next.getDate() + dir);
    if (calView === 'week') next.setDate(next.getDate() + dir * 7);
    if (calView === 'month') next.setMonth(next.getMonth() + dir);
    setFocusDate(next);
  };

  const focusYMD = toYMD(focusDate);

  // Week range (Monday -> Sunday)
  const getWeekDates = () => {
    const d = new Date(focusDate);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    return Array.from({ length: 7 }).map((_, i) => {
      const item = new Date(monday);
      item.setDate(monday.getDate() + i);
      return item;
    });
  };

  const monthYear = focusDate.getFullYear();
  const monthIdx = focusDate.getMonth();
  const firstMonthDay = new Date(monthYear, monthIdx, 1).getDay();
  const monthOffset = firstMonthDay === 0 ? 6 : firstMonthDay - 1;
  const daysInMonth = new Date(monthYear, monthIdx + 1, 0).getDate();

  return (
    <div className="space-y-6">
      {/* Top Sub-navigation */}
      <div className="bg-white border border-neutral-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="inline-flex bg-neutral-100 p-1 border border-neutral-200 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setSubTab('calendar')}
            className={`px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'calendar'
                ? 'bg-[#0B0B0C] text-white'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Calendrier des rendez-vous
          </button>
          <button
            type="button"
            onClick={() => setSubTab('availability')}
            className={`px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'availability'
                ? 'bg-[#0B0B0C] text-white'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Horaires & Créneaux bloqués
          </button>
        </div>

        <button
          type="button"
          onClick={() => setManualModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#0B0B0C] text-white text-xs font-medium hover:bg-neutral-800 whitespace-nowrap cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-[#C5A46D]" />
          <span>Ajouter un rendez-vous</span>
        </button>
      </div>

      {subTab === 'calendar' && (
        <div className="bg-white border border-neutral-200 p-5 space-y-5">
          {/* Calendar Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => shiftFocus(-1)}
                className="p-2 border border-neutral-200 hover:border-neutral-900 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h3 className="font-serif text-xl font-semibold text-neutral-900 min-w-[200px] text-center">
                {calView === 'month' && `${MONTH_NAMES[monthIdx]} ${monthYear}`}
                {calView === 'day' &&
                  focusDate.toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                {calView === 'week' &&
                  `Semaine du ${getWeekDates()[0].toLocaleDateString('fr-FR')}`}
              </h3>
              <button
                type="button"
                onClick={() => shiftFocus(1)}
                className="p-2 border border-neutral-200 hover:border-neutral-900 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="inline-flex bg-neutral-100 p-1 border border-neutral-200 self-start">
              {(['day', 'week', 'month'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setCalView(v)}
                  className={`px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    calView === v ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600'
                  }`}
                >
                  {v === 'day' ? 'Jour' : v === 'week' ? 'Semaine' : 'Mois'}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="h-64 bg-neutral-50 animate-pulse" />
          ) : calView === 'month' ? (
            <div className="overflow-x-auto">
              <div className="min-w-[640px] grid grid-cols-7 gap-px bg-neutral-200 border border-neutral-200">
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((wd) => (
                  <div
                    key={wd}
                    className="bg-neutral-50 py-2 text-center text-xs font-semibold text-neutral-600"
                  >
                    {wd}
                  </div>
                ))}
                {Array.from({ length: monthOffset }).map((_, i) => (
                  <div key={`pad-${i}`} className="bg-neutral-50/50 min-h-[100px]" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const ymd = `${monthYear}-${String(monthIdx + 1).padStart(2, '0')}-${String(
                    dayNum
                  ).padStart(2, '0')}`;
                  const dayAppts = appointments.filter((a) => a.appointment_date === ymd);
                  const isToday = ymd === toYMD(new Date());

                  return (
                    <div
                      key={ymd}
                      onClick={() => {
                        setFocusDate(new Date(`${ymd}T12:00:00`));
                        setCalView('day');
                      }}
                      className={`bg-white min-h-[105px] p-2 cursor-pointer hover:bg-neutral-50 transition-colors ${
                        isToday ? 'ring-1 ring-inset ring-[#C5A46D]' : ''
                      }`}
                    >
                      <span
                        className={`text-xs font-mono tabular-nums font-medium ${
                          isToday ? 'text-[#A6854E] font-bold' : 'text-neutral-700'
                        }`}
                      >
                        {dayNum}
                      </span>
                      <div className="mt-1.5 space-y-1">
                        {dayAppts.slice(0, 3).map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openApptDetail(a);
                            }}
                            className={`w-full text-left px-1.5 py-0.5 text-[11px] truncate border cursor-pointer ${
                              STATUS_MAP[a.status].cls
                            }`}
                          >
                            <span className="font-mono">{a.appointment_time}</span> · {a.customer_name}
                          </button>
                        ))}
                        {dayAppts.length > 3 && (
                          <p className="text-[10px] text-neutral-500 pl-1">
                            +{dayAppts.length - 3} autres
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : calView === 'week' ? (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
              {getWeekDates().map((d) => {
                const ymd = toYMD(d);
                const dayAppts = appointments.filter((a) => a.appointment_date === ymd);
                return (
                  <div key={ymd} className="border border-neutral-200 bg-neutral-50/40 p-3 min-h-[240px]">
                    <p className="text-xs font-semibold text-neutral-900 pb-2 mb-2 border-b border-neutral-200">
                      {d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}
                    </p>
                    <div className="space-y-2">
                      {dayAppts.length === 0 ? (
                        <p className="text-[11px] text-neutral-400">Aucun RDV</p>
                      ) : (
                        dayAppts.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => openApptDetail(a)}
                            className={`w-full text-left p-2 border text-xs cursor-pointer ${
                              STATUS_MAP[a.status].cls
                            }`}
                          >
                            <p className="font-mono font-semibold">{a.appointment_time}</p>
                            <p className="font-medium truncate">{a.customer_name}</p>
                            <p className="text-[10px] opacity-80 truncate">{a.watch_type}</p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {appointments.filter((a) => a.appointment_date === focusYMD).length === 0 ? (
                <div className="py-12 text-center border border-dashed border-neutral-300 text-xs text-neutral-500">
                  Aucun rendez-vous prévu pour cette journée.
                </div>
              ) : (
                appointments
                  .filter((a) => a.appointment_date === focusYMD)
                  .map((a) => (
                    <div
                      key={a.id}
                      onClick={() => openApptDetail(a)}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border border-neutral-200 hover:border-neutral-900 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-base font-semibold text-[#A6854E] tabular-nums">
                          {a.appointment_time}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-neutral-900">
                            {a.customer_name}{' '}
                            <span className="font-mono text-xs text-neutral-500 font-normal">
                              ({a.customer_phone})
                            </span>
                          </p>
                          <p className="text-xs text-neutral-600">
                            {a.watch_type}
                            {a.problem_description ? ` — ${a.problem_description}` : ''}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 text-xs font-medium border self-start sm:self-center ${
                          STATUS_MAP[a.status].cls
                        }`}
                      >
                        {STATUS_MAP[a.status].label}
                      </span>
                    </div>
                  ))
              )}
            </div>
          )}
        </div>
      )}

      {subTab === 'availability' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Weekly Working Hours */}
          <div className="lg:col-span-7 bg-white border border-neutral-200 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#A6854E]" />
                  <span>Jours et horaires d’ouverture</span>
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Définit les créneaux disponibles sur le calendrier public.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveSchedule}
                className="px-4 py-2 bg-[#0B0B0C] text-white text-xs font-medium hover:bg-neutral-800 cursor-pointer"
              >
                Enregistrer les horaires
              </button>
            </div>

            <div className="divide-y divide-neutral-100 border border-neutral-200">
              {schedules.map((s) => (
                <div
                  key={s.day_of_week}
                  className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <label className="inline-flex items-center gap-2.5 min-w-[120px] font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={s.is_working_day}
                      onChange={(e) =>
                        setSchedules((prev) =>
                          prev.map((item) =>
                            item.day_of_week === s.day_of_week
                              ? { ...item, is_working_day: e.target.checked }
                              : item
                          )
                        )
                      }
                      className="accent-[#0B0B0C]"
                    />
                    <span>{DAY_NAMES[s.day_of_week]}</span>
                  </label>

                  {s.is_working_day ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={s.start_time}
                        onChange={(e) =>
                          setSchedules((prev) =>
                            prev.map((item) =>
                              item.day_of_week === s.day_of_week
                                ? { ...item, start_time: e.target.value }
                                : item
                            )
                          )
                        }
                        className="px-2 py-1 border border-neutral-300 font-mono"
                      />
                      <span>à</span>
                      <input
                        type="time"
                        value={s.end_time}
                        onChange={(e) =>
                          setSchedules((prev) =>
                            prev.map((item) =>
                              item.day_of_week === s.day_of_week
                                ? { ...item, end_time: e.target.value }
                                : item
                            )
                          )
                        }
                        className="px-2 py-1 border border-neutral-300 font-mono"
                      />
                    </div>
                  ) : (
                    <span className="text-neutral-400">Fermé</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Block Specific Slots */}
          <div className="lg:col-span-5 bg-white border border-neutral-200 p-6 space-y-5">
            <div>
              <h3 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#A6854E]" />
                <span>Bloquer une date ou un horaire</span>
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Laissez l’heure vide pour bloquer toute la journée.
              </p>
            </div>

            <form onSubmit={handleBlockSlot} className="space-y-3 bg-neutral-50 p-4 border border-neutral-200">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={blockForm.specific_date}
                    onChange={(e) => setBlockForm({ ...blockForm, specific_date: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-neutral-300 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-700 mb-1">
                    Heure (optionnel)
                  </label>
                  <input
                    type="time"
                    value={blockForm.start_time}
                    onChange={(e) => setBlockForm({ ...blockForm, start_time: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-neutral-300 text-xs font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-neutral-700 mb-1">
                  Motif
                </label>
                <input
                  type="text"
                  value={blockForm.reason}
                  onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-white border border-neutral-300 text-xs"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-[#0B0B0C] text-white text-xs font-medium hover:bg-neutral-800 cursor-pointer"
              >
                Bloquer ce créneau
              </button>
            </form>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {blockedSlots.length === 0 ? (
                <p className="text-xs text-neutral-400">Aucun créneau bloqué manuellement.</p>
              ) : (
                blockedSlots.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between px-3 py-2 border border-neutral-200 text-xs"
                  >
                    <div>
                      <span className="font-mono font-semibold text-neutral-900">
                        {b.specific_date} {b.start_time ? `· ${b.start_time}` : '(Journée complète)'}
                      </span>
                      <p className="text-[11px] text-neutral-500">{b.reason}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnblock(b.id)}
                      className="p-1.5 text-neutral-400 hover:text-red-600 cursor-pointer"
                      title="Débloquer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Appointment Detail Modal */}
      {selectedAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white border border-neutral-200 w-full max-w-lg shadow-2xl">
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h3 className="font-serif text-xl font-semibold">
                  Rendez-vous {selectedAppt.reference_code}
                </h3>
                <p className="text-xs text-neutral-500">
                  {selectedAppt.customer_name} · {selectedAppt.customer_phone}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAppt(null)}
                className="p-1.5 text-neutral-500 hover:text-neutral-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div className="bg-neutral-50 border border-neutral-200 p-3.5 space-y-1 text-xs">
                <p>
                  <strong>Type de montre :</strong> {selectedAppt.watch_type}
                </p>
                <p>
                  <strong>Problème signalé :</strong>{' '}
                  {selectedAppt.problem_description || 'Aucune description fournie.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Heure</label>
                  <input
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Notes atelier
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() =>
                    updateAppt(selectedAppt.id, {
                      appointment_date: editDate,
                      appointment_time: editTime,
                      admin_notes: editNotes,
                      status: 'confirme',
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-800 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirmer / Enregistrer</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateAppt(selectedAppt.id, {
                      appointment_date: editDate,
                      appointment_time: editTime,
                      admin_notes: editNotes,
                      status: 'termine',
                    })
                  }
                  className="px-3.5 py-2 bg-neutral-800 text-white text-xs font-medium hover:bg-neutral-900 cursor-pointer"
                >
                  Marquer terminé
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateAppt(selectedAppt.id, {
                      status: 'annule',
                      admin_notes: editNotes,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-red-300 text-red-700 text-xs font-medium hover:bg-red-50 ml-auto cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Annuler RDV</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Creation Modal */}
      {manualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white border border-neutral-200 w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
              <h3 className="font-serif text-xl font-semibold">Nouveau rendez-vous manuel</h3>
              <button
                type="button"
                onClick={() => setManualModal(false)}
                className="p-1.5 text-neutral-500 hover:text-neutral-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleManualCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Nom du client *
                </label>
                <input
                  type="text"
                  required
                  value={manualForm.customer_name}
                  onChange={(e) => setManualForm({ ...manualForm, customer_name: e.target.value })}
                  className="w-full px-3 py-2 min-h-[44px] border border-neutral-300 text-base sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Téléphone *
                </label>
                <input
                  type="tel"
                  required
                  value={manualForm.customer_phone}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, customer_phone: e.target.value })
                  }
                  className="w-full px-3 py-2 min-h-[44px] border border-neutral-300 text-base sm:text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={manualForm.appointment_date}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, appointment_date: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-neutral-300 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Heure *</label>
                  <input
                    type="time"
                    required
                    value={manualForm.appointment_time}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, appointment_time: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-neutral-300 text-xs font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Type de montre
                </label>
                <select
                  value={manualForm.watch_type}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, watch_type: e.target.value as WatchType })
                  }
                  className="w-full px-3 py-2 border border-neutral-300 text-sm"
                >
                  <option value="Montre classique">Montre classique</option>
                  <option value="Montre automatique">Montre automatique</option>
                  <option value="Montre connectée">Montre connectée</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Description du problème
                </label>
                <textarea
                  rows={2}
                  value={manualForm.problem_description}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, problem_description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-neutral-300 text-sm"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-[#0B0B0C] text-white text-xs font-medium hover:bg-neutral-800 cursor-pointer"
              >
                Enregistrer le rendez-vous
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

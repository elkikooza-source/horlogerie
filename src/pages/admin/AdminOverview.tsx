import React, { useEffect, useState, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { DashboardStats } from '../../types';
import { useStore } from '../../context/StoreContext';

interface AdminOverviewProps {
  token: string;
}

export function AdminOverview({ token }: AdminOverviewProps) {
  const { formatPrice } = useStore();
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('month');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/stats?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setStats(await res.json());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [token, period]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading && !stats) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-28 bg-white border border-neutral-200 animate-pulse" />
          ))}
        </div>
        <div className="h-80 bg-white border border-neutral-200 animate-pulse" />
      </div>
    );
  }

  if (!stats) return null;

  const kpis = [
    {
      label: 'Chiffre d’affaires total',
      value: formatPrice(stats.total_revenue),
      sub: 'Hors commandes annulées',
    },
    {
      label: 'CA du jour',
      value: formatPrice(stats.today_revenue),
      sub: 'Aujourd’hui',
    },
    {
      label: 'CA de la semaine',
      value: formatPrice(stats.week_revenue),
      sub: '7 derniers jours',
    },
    {
      label: 'CA du mois',
      value: formatPrice(stats.month_revenue),
      sub: 'Mois en cours',
    },
    {
      label: 'Commandes totales',
      value: String(stats.total_orders),
      sub: `${stats.pending_orders} en attente`,
    },
    {
      label: 'Produits disponibles',
      value: String(stats.available_products),
      sub: 'Actifs en stock',
    },
    {
      label: 'Clients enregistrés',
      value: String(stats.total_customers),
      sub: 'Base clients réelle',
    },
    {
      label: 'Rendez-vous atelier',
      value: String(stats.total_appointments),
      sub: `${stats.pending_appointments} à confirmer`,
    },
    {
      label:
        period === 'today'
          ? 'Commandes aujourd’hui'
          : period === 'week'
          ? 'Commandes cette semaine'
          : 'Commandes ce mois',
      value: String(stats.period_orders),
      sub: `Total période : ${formatPrice(stats.period_revenue)}`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Period Selector Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-neutral-200 p-4">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">
            Indicateurs de performance réels
          </h2>
          <p className="text-xs text-neutral-500">
            Calculés automatiquement à partir des commandes et rendez-vous enregistrés en base.
          </p>
        </div>

        <div className="inline-flex bg-neutral-100 p-1 border border-neutral-200 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setPeriod('today')}
            className={`px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              period === 'today'
                ? 'bg-[#0B0B0C] text-white'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Aujourd’hui
          </button>
          <button
            type="button"
            onClick={() => setPeriod('week')}
            className={`px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              period === 'week'
                ? 'bg-[#0B0B0C] text-white'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Cette semaine
          </button>
          <button
            type="button"
            onClick={() => setPeriod('month')}
            className={`px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              period === 'month'
                ? 'bg-[#0B0B0C] text-white'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Ce mois
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white border border-neutral-200 p-5">
            <p className="text-xs font-medium text-neutral-500 mb-1.5">{kpi.label}</p>
            <p className="font-mono tabular-nums text-2xl font-semibold text-neutral-900">
              {kpi.value}
            </p>
            <p className="text-xs text-neutral-500 mt-1.5 tabular-nums">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Revenue Evolution Chart */}
      <div className="bg-white border border-neutral-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">
              Évolution du chiffre d’affaires
            </h3>
            <p className="text-xs text-neutral-500">
              {period === 'today'
                ? 'Répartition horaire du jour'
                : period === 'week'
                ? '7 derniers jours'
                : '30 derniers jours'}
            </p>
          </div>
          <span className="font-mono tabular-nums text-sm font-semibold text-[#A6854E]">
            {formatPrice(stats.period_revenue)}
          </span>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.chart_data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="goldRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C5A46D" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#C5A46D" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#737373' }}
                axisLine={{ stroke: '#E5E5E5' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#737373' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0B0B0C',
                  border: '1px solid #C5A46D',
                  borderRadius: 0,
                  color: '#F7F5F0',
                  fontSize: '12px',
                }}
                formatter={(value: any) => [formatPrice(Number(value)), 'Chiffre d’affaires']}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#A6854E"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#goldRev)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {stats.total_orders === 0 && (
          <p className="text-xs text-neutral-500 text-center mt-4">
            Aucune commande enregistrée pour le moment. Les courbes se mettront à jour
            automatiquement dès la première commande client.
          </p>
        )}
      </div>
    </div>
  );
}

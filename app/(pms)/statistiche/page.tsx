"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useToast } from "../../components/toast";

interface StatsData {
  totalRevenue: number;
  totalBookings: number;
  totalCancellations: number;
  totalNightsSold: number;
  adr: number;
  monthly: Array<{
    month: string;
    revenue: number;
    bookings: number;
    cancellations: number;
    nightsSold: number;
    adr: number;
  }>;
  byChannel: Array<{
    channel: string;
    revenue: number;
    bookings: number;
  }>;
  occupancyMonthly: Array<{
    month: string;
    occupancy: number;
  }>;
  sparkline: Array<{
    revenue: number;
    bookings: number;
    cancellations: number;
  }>;
}

const CHANNEL_COLORS: Record<string, string> = {
  booking: "#003580",
  direct: "#22C55E",
  expedia: "#F59E0B",
  airbnb: "#14B8A6",
  other: "#94A3B8",
};

function fmtEur(n: number) {
  return n.toLocaleString("it-IT", { minimumFractionDigits: 2 }) + " \u20AC";
}

function fmtMonth(m: string) {
  const [y, mo] = m.split("-");
  const d = new Date(parseInt(y), parseInt(mo) - 1, 1);
  return d.toLocaleDateString("it-IT", { month: "short", year: "2-digit" });
}

export default function StatistichePage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [period, setPeriod] = useState("year");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/statistiche?period=${period}`);
      if (!res.ok) throw new Error("Errore");
      setData(await res.json());
    } catch {
      toast("Errore caricamento statistiche", "error");
    } finally {
      setLoading(false);
    }
  }, [period, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const hasData = data && data.totalBookings > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold text-gray-900">Statistiche</h2>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {[
            { value: "month", label: "Mese" },
            { value: "year", label: "Anno" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${period === opt.value ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <StatsSkeleton />
      ) : !hasData ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-sm">Dati insufficienti per visualizzare le statistiche</p>
          <p className="text-gray-400 text-xs mt-1">Le statistiche appariranno con piu prenotazioni nel sistema</p>
        </div>
      ) : (
        <>
          {/* KPI Cards with sparklines */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KPICardWithSparkline
              label="Revenue totale"
              value={fmtEur(data.totalRevenue)}
              sparkData={data.sparkline.map((s) => s.revenue)}
              color="#3B82F6"
            />
            <KPICardWithSparkline
              label="Prenotazioni totali"
              value={String(data.totalBookings)}
              sparkData={data.sparkline.map((s) => s.bookings)}
              color="#22C55E"
            />
            <KPICardWithSparkline
              label="Cancellazioni"
              value={String(data.totalCancellations)}
              sparkData={data.sparkline.map((s) => s.cancellations)}
              color="#EF4444"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Occupancy bar chart */}
            {data.occupancyMonthly.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Occupazione mensile</h3>
                <BarChart data={data.occupancyMonthly.map((m) => ({ label: fmtMonth(m.month), value: m.occupancy }))} unit="%" color="#3B82F6" />
              </div>
            )}

            {/* Revenue by channel */}
            {data.byChannel.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Revenue per canale</h3>
                <HorizontalBarChart data={data.byChannel.map((c) => ({
                  label: c.channel === "direct" ? "Diretto" : c.channel.charAt(0).toUpperCase() + c.channel.slice(1),
                  value: c.revenue,
                  color: CHANNEL_COLORS[c.channel] ?? CHANNEL_COLORS.other,
                }))} />
              </div>
            )}

            {/* ADR line chart */}
            {data.monthly.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-1">ADR (Tariffa Media Giornaliera)</h3>
                <p className="text-xs text-gray-400 mb-4">Revenue / notti vendute</p>
                <LineChart data={data.monthly.map((m) => ({ label: fmtMonth(m.month), value: m.adr }))} color="#8B5CF6" />
              </div>
            )}

            {/* Bookings by channel donut */}
            {data.byChannel.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Prenotazioni per canale</h3>
                <DonutChart data={data.byChannel.map((c) => ({
                  label: c.channel === "direct" ? "Diretto" : c.channel.charAt(0).toUpperCase() + c.channel.slice(1),
                  value: c.bookings,
                  color: CHANNEL_COLORS[c.channel] ?? CHANNEL_COLORS.other,
                }))} />
              </div>
            )}
          </div>

          {/* Summary table */}
          {data.monthly.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800">Riepilogo mensile</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-2 text-left font-semibold text-gray-600">Mese</th>
                      <th className="px-4 py-2 text-right font-semibold text-gray-600">Revenue</th>
                      <th className="px-4 py-2 text-right font-semibold text-gray-600">Prenotazioni</th>
                      <th className="px-4 py-2 text-right font-semibold text-gray-600">Cancellazioni</th>
                      <th className="px-4 py-2 text-right font-semibold text-gray-600">Notti</th>
                      <th className="px-4 py-2 text-right font-semibold text-gray-600">ADR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthly.map((m) => (
                      <tr key={m.month} className="border-b border-gray-50">
                        <td className="px-4 py-2 text-gray-700 font-medium capitalize">{fmtMonth(m.month)}</td>
                        <td className="px-4 py-2 text-right text-gray-700 font-mono">{fmtEur(m.revenue)}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{m.bookings}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{m.cancellations}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{m.nightsSold}</td>
                        <td className="px-4 py-2 text-right text-gray-700 font-mono">
                          {m.nightsSold > 0 ? fmtEur(m.adr) : "\u2014"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---- Chart Components (pure CSS/SVG, no libraries) ---- */

function KPICardWithSparkline({ label, value, sparkData, color }: { label: string; value: string; sparkData: number[]; color: string }) {
  const max = Math.max(...sparkData, 1);
  const points = sparkData.map((v, i) => {
    const x = (i / Math.max(sparkData.length - 1, 1)) * 100;
    const y = 100 - (v / max) * 80;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 relative overflow-hidden">
      <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sparkData.length >= 2 && (
        <svg className="absolute bottom-0 right-0 w-24 h-12 opacity-30" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline points={points} fill="none" stroke={color} strokeWidth="3" />
        </svg>
      )}
    </div>
  );
}

function BarChart({ data, unit, color }: { data: Array<{ label: string; value: number }>; unit: string; color: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-1 h-36">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center group relative">
          <div
            className="w-full rounded-t transition-all"
            style={{
              height: `${(d.value / max) * 100}%`,
              minHeight: d.value > 0 ? "2px" : "0",
              background: color,
              opacity: 0.8,
            }}
          />
          <div className="text-[9px] text-gray-400 mt-1 truncate w-full text-center">{d.label}</div>
          <div className="absolute -top-7 bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
            {d.value}{unit}
          </div>
        </div>
      ))}
    </div>
  );
}

function HorizontalBarChart({ data }: { data: Array<{ label: string; value: number; color: string }> }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-700 font-medium capitalize">{d.label}</span>
            <span className="text-gray-500 font-mono">{fmtEur(d.value)}</span>
          </div>
          <div className="h-5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(d.value / max) * 100}%`, background: d.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function LineChart({ data, color }: { data: Array<{ label: string; value: number }>; color: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const w = 400;
  const h = 120;
  const pad = 10;

  const points = data.map((d, i) => {
    const x = pad + (i / Math.max(data.length - 1, 1)) * (w - pad * 2);
    const y = h - pad - ((d.value / max) * (h - pad * 2));
    return { x, y, ...d };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-32">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((pct) => (
          <line key={pct} x1={pad} x2={w - pad} y1={h - pad - (pct / 100) * (h - pad * 2)} y2={h - pad - (pct / 100) * (h - pad * 2)} stroke="#f1f5f9" strokeWidth="1" />
        ))}
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} />
        ))}
      </svg>
      <div className="flex justify-between text-[9px] text-gray-400 px-2">
        {data.map((d, i) => (
          <span key={i} className="truncate">{d.label}</span>
        ))}
      </div>
    </div>
  );
}

function DonutChart({ data }: { data: Array<{ label: string; value: number; color: string }> }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <p className="text-xs text-gray-400 text-center py-4">Nessun dato</p>;

  const size = 120;
  const cx = size / 2;
  const cy = size / 2;
  const r = 45;
  const rInner = 28;

  let cumAngle = -90;
  const segments = data.map((d) => {
    const angle = (d.value / total) * 360;
    const start = cumAngle;
    cumAngle += angle;
    return { ...d, startAngle: start, angle };
  });

  function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
  }

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((s, i) => (
          <path
            key={i}
            d={arcPath(cx, cy, r, s.startAngle, s.startAngle + s.angle - 0.5)}
            fill="none"
            stroke={s.color}
            strokeWidth={r - rInner}
            strokeLinecap="round"
          />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" className="text-lg font-bold fill-gray-900">{total}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" className="text-[9px] fill-gray-400">totale</text>
      </svg>
      <div className="space-y-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-gray-700 capitalize">{d.label}</span>
            <span className="text-gray-400 ml-auto">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-[88px] skeleton rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[220px] skeleton rounded-xl" />)}
      </div>
    </div>
  );
}

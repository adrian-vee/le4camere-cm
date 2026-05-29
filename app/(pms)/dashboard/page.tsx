"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useToast } from "../../components/toast";

interface DashboardData {
  arrivals: number;
  departures: number;
  inHouse: number;
  totalRooms: number;
  occupancy: number;
  occupancyMonth: number;
  revenueMonth: number;
  bookingsMonth: number;
  events: Array<{
    id: string;
    guest: string;
    roomType: string;
    type: "checkin" | "checkout";
    date: string;
    adults: number;
    children: number;
    nights: number;
  }>;
  activities: Array<{
    id: string;
    guest: string;
    roomType: string;
    channel: string;
    totalPrice: number;
    status: string;
    createdAt: string;
  }>;
  channelStatus: Array<{
    id: string;
    name: string;
    enabled: boolean;
    lastSync: { status: string; createdAt: string } | null;
  }>;
}

const CHANNEL_COLORS: Record<string, string> = {
  booking: "bg-[#003580]",
  direct: "bg-emerald-500",
  expedia: "bg-amber-500",
  airbnb: "bg-teal-500",
  other: "bg-gray-400",
};

const CHANNEL_LETTERS: Record<string, string> = {
  booking: "B",
  direct: "D",
  expedia: "E",
  airbnb: "A",
  other: "?",
};

function fmtEur(n: number) {
  return n.toLocaleString("it-IT", { minimumFractionDigits: 2 }) + " \u20AC";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ora";
  if (mins < 60) return `${mins} min fa`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ore fa`;
  const days = Math.floor(hours / 24);
  return `${days}g fa`;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Errore");
      setData(await res.json());
    } catch {
      toast("Errore caricamento dashboard", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <DashboardSkeleton />;
  if (!data) return <div className="text-red-600 p-4">Errore nel caricamento</div>;

  return (
    <div className="space-y-5">
      {/* KPI bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard label="Arrivi oggi" value={data.arrivals} icon="arrivals" />
        <KPICard label="Partenze oggi" value={data.departures} icon="departures" />
        <KPICard label="In casa" value={data.inHouse} icon="inhouse" />
        <KPICard label="Occupazione" value={`${data.occupancy}%`} icon="occupancy" highlight />
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left column (3/5) */}
        <div className="lg:col-span-3 space-y-5">
          {/* Events */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">Prossimi eventi</h3>
              <Link href="/calendario" className="text-xs text-blue-600 hover:underline">Vedi calendario</Link>
            </div>
            <div className="divide-y divide-gray-50 max-h-[360px] overflow-y-auto">
              {data.events.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center">Nessun evento per oggi</p>
              ) : (
                data.events.map((ev) => (
                  <Link key={ev.id} href={`/prenotazioni/${ev.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                      ev.type === "checkin" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                    }`}>
                      {ev.type === "checkin" ? "Check-in" : "Check-out"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{ev.guest}</p>
                      <p className="text-xs text-gray-500">{ev.roomType}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
                        </svg>
                        {ev.adults}{ev.children > 0 && `+${ev.children}`}
                      </div>
                      <p className="text-[10px] text-gray-400">{ev.nights} notti</p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Monthly KPIs */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Occupazione mese</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{data.occupancyMonth}%</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Revenue mese</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{fmtEur(data.revenueMonth)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Prenotazioni</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{data.bookingsMonth}</p>
            </div>
          </div>
        </div>

        {/* Right column (2/5) */}
        <div className="lg:col-span-2 space-y-5">
          {/* Activities feed */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Ultime attivita</h3>
            </div>
            <div className="divide-y divide-gray-50 max-h-[320px] overflow-y-auto">
              {data.activities.map((a) => (
                <Link key={a.id} href={`/prenotazioni/${a.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <span className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold mt-0.5 ${CHANNEL_COLORS[a.channel] ?? CHANNEL_COLORS.other}`}>
                    {CHANNEL_LETTERS[a.channel] ?? "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500">
                      {a.status === "cancelled" ? "Cancellazione" : a.status === "modified" ? "Modifica" : "Nuova prenotazione"}
                    </p>
                    <p className="text-sm font-medium text-gray-900 truncate">{a.guest}</p>
                    <p className="text-xs text-gray-400">{a.roomType} &middot; {fmtEur(a.totalPrice)}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">{timeAgo(a.createdAt)}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Channel status */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">Stato sincronizzazione</h3>
              <Link href="/canali" className="text-xs text-blue-600 hover:underline">Gestisci</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {data.channelStatus.map((ch) => (
                <div key={ch.id} className="flex items-center gap-3 px-5 py-3">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    !ch.enabled ? "bg-gray-300" : ch.lastSync?.status === "success" ? "bg-emerald-500" : ch.lastSync ? "bg-red-500" : "bg-gray-300"
                  }`} />
                  <span className="text-sm font-medium text-gray-700 capitalize flex-1">{ch.name}</span>
                  <span className="text-[10px] text-gray-400">
                    {ch.lastSync
                      ? new Date(ch.lastSync.createdAt).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                      : "Mai sincronizzato"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, icon, highlight }: { label: string; value: string | number; icon: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? "bg-blue-600 text-white border-blue-600" : "bg-white border-gray-200"}`}>
      <div className="flex items-center justify-between mb-1">
        <p className={`text-[11px] font-medium uppercase tracking-wide ${highlight ? "text-blue-100" : "text-gray-500"}`}>{label}</p>
        {icon === "arrivals" && <ArrowDownIcon className={`w-4 h-4 ${highlight ? "text-blue-200" : "text-emerald-400"}`} />}
        {icon === "departures" && <ArrowUpIcon className={`w-4 h-4 ${highlight ? "text-blue-200" : "text-gray-400"}`} />}
        {icon === "inhouse" && <HomeIcon className={`w-4 h-4 ${highlight ? "text-blue-200" : "text-blue-400"}`} />}
        {icon === "occupancy" && <ChartIcon className={`w-4 h-4 ${highlight ? "text-blue-200" : "text-violet-400"}`} />}
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function ArrowDownIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" /></svg>;
}
function ArrowUpIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" /></svg>;
}
function HomeIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955a1.126 1.126 0 0 1 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" /></svg>;
}
function ChartIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[88px] skeleton rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 space-y-5">
          <div className="h-[300px] skeleton rounded-xl" />
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-[80px] skeleton rounded-xl" />)}
          </div>
        </div>
        <div className="lg:col-span-2 space-y-5">
          <div className="h-[280px] skeleton rounded-xl" />
          <div className="h-[160px] skeleton rounded-xl" />
        </div>
      </div>
    </div>
  );
}

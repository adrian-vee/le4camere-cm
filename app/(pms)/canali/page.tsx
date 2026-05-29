"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "../../components/toast";

interface ChannelListItem {
  id: string;
  name: string;
  providerType: string;
  enabled: boolean;
  lastSync: { event: string; status: string; createdAt: string } | null;
  failedJobs: number;
  reservationCount: number;
}

interface ChannelDetail {
  id: string;
  name: string;
  providerType: string;
  enabled: boolean;
  mappings: Array<{ id: string; roomType: string; ratePlan: string; externalRoomId: string; externalRateId: string }>;
  syncLogs: Array<{ event: string; status: string; direction: string; createdAt: string }>;
  failedJobs: Array<{ id: string; type: string; lastError: string; attempts: number; createdAt: string }>;
}

const CHANNEL_ICONS: Record<string, { letter: string; bg: string }> = {
  booking: { letter: "B", bg: "bg-[#003580]" },
  direct: { letter: "D", bg: "bg-emerald-500" },
  expedia: { letter: "E", bg: "bg-amber-500" },
  airbnb: { letter: "A", bg: "bg-teal-500" },
  other: { letter: "?", bg: "bg-gray-400" },
};

const AVAILABLE_TYPES = [
  { type: "mock", name: "Mock (Test)", available: true },
  { type: "ical", name: "iCal Import", available: true },
  { type: "connectivity_api", name: "Booking.com", available: false },
  { type: "ota_direct", name: "Expedia", available: false },
  { type: "ota_direct", name: "Airbnb", available: false },
];

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
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

export default function CanaliPage() {
  const [channels, setChannels] = useState<ChannelListItem[]>([]);
  const [detail, setDetail] = useState<ChannelDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showErrors, setShowErrors] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchChannels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/canali");
      if (!res.ok) throw new Error("Errore");
      setChannels(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  const fetchDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/canali/${id}`);
      if (!res.ok) throw new Error("Errore");
      setDetail(await res.json());
    } catch {
      toast("Errore caricamento dettaglio", "error");
    }
  };

  const handleToggle = async (id: string, currentEnabled: boolean) => {
    try {
      const res = await fetch(`/api/canali/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !currentEnabled }),
      });
      if (!res.ok) throw new Error("Errore");
      toast(`Canale ${!currentEnabled ? "attivato" : "disattivato"}`, "success");
      await fetchChannels();
      if (detail?.id === id) await fetchDetail(id);
    } catch {
      toast("Errore modifica canale", "error");
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync/run", { method: "POST" });
      const result = await res.json();
      if (result.ok) {
        toast(`Sync: ${result.processed} elaborati, ${result.failed} falliti`, "success");
      } else {
        toast(`Errore: ${result.error}`, "error");
      }
      await fetchChannels();
      if (detail) await fetchDetail(detail.id);
    } catch {
      toast("Errore di rete", "error");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Canali</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAdd(!showAdd)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 font-medium text-gray-600">
            + Aggiungi canale
          </button>
          <button onClick={handleSync} disabled={syncing}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2">
            {syncing && <Spinner />}
            {syncing ? "Sincronizzazione..." : "Sincronizza"}
          </button>
        </div>
      </div>

      {/* Add channel panel */}
      {showAdd && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Aggiungi canale</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {AVAILABLE_TYPES.map((t, i) => (
              <div key={i} className={`rounded-lg border p-3 text-center ${t.available ? "border-gray-200 hover:border-blue-300 cursor-pointer" : "border-gray-100 opacity-50"}`}>
                <p className="text-sm font-medium text-gray-800">{t.name}</p>
                {!t.available && <p className="text-[10px] text-gray-400 mt-1">Coming soon</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-[180px] skeleton rounded-xl" />)}
        </div>
      ) : channels.length === 0 ? (
        <div className="text-gray-400 bg-white rounded-xl border border-gray-200 p-10 text-center text-sm">
          Nessun canale configurato
        </div>
      ) : (
        <div className="flex gap-5 flex-col lg:flex-row">
          {/* Channel cards */}
          <div className="flex-1 space-y-3">
            {channels.map((ch) => {
              const icon = CHANNEL_ICONS[ch.name] ?? CHANNEL_ICONS.other;
              const isSelected = detail?.id === ch.id;

              return (
                <div key={ch.id}
                  className={`bg-white rounded-xl border p-5 cursor-pointer transition-all ${
                    isSelected ? "border-blue-400 ring-1 ring-blue-200" : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => fetchDetail(ch.id)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${icon.bg} flex items-center justify-center text-white text-sm font-bold`}>
                        {icon.letter}
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 capitalize">{ch.name}</h3>
                        <p className="text-[10px] text-gray-400">{ch.providerType}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggle(ch.id, ch.enabled); }}
                      className={`relative w-10 h-5 rounded-full transition-colors ${ch.enabled ? "bg-emerald-500" : "bg-gray-300"}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${ch.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-gray-400 mb-0.5">Ultima sync</p>
                      {ch.lastSync ? (
                        <p className="text-gray-700">{timeAgo(ch.lastSync.createdAt)}</p>
                      ) : (
                        <p className="text-gray-300">Mai</p>
                      )}
                    </div>
                    <div>
                      <p className="text-gray-400 mb-0.5">Stato</p>
                      {ch.lastSync ? (
                        <div className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${ch.lastSync.status === "success" ? "bg-emerald-500" : "bg-red-500"}`} />
                          <span className={`font-medium ${ch.lastSync.status === "success" ? "text-emerald-600" : "text-red-600"}`}>
                            {ch.lastSync.status === "success" ? "OK" : "Errore"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-300">\u2014</span>
                      )}
                    </div>
                    <div>
                      <p className="text-gray-400 mb-0.5">Prenotazioni</p>
                      <span className="font-medium text-gray-700">{ch.reservationCount}</span>
                    </div>
                  </div>

                  {ch.failedJobs > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowErrors(showErrors === ch.id ? null : ch.id); fetchDetail(ch.id); }}
                        className="text-xs text-red-600 font-medium hover:underline"
                      >
                        {ch.failedJobs} errori recenti {showErrors === ch.id ? "\u25B2" : "\u25BC"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Detail panel */}
          {detail && (
            <div className="w-full lg:w-80 shrink-0 bg-white rounded-xl border border-gray-200 p-5 self-start max-h-[70vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900 capitalize">{detail.name}</h3>
                <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
              </div>

              {/* Mappings */}
              {detail.mappings.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-2">Mapping</h4>
                  {detail.mappings.map((m) => (
                    <div key={m.id} className="text-xs bg-gray-50 rounded-lg p-2 mb-1">
                      <p className="font-medium text-gray-700">{m.roomType} \u2014 {m.ratePlan}</p>
                      <p className="text-gray-400">Ext: {m.externalRoomId} / {m.externalRateId}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Sync logs */}
              <div className="mb-4">
                <h4 className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-2">Log sincronizzazione</h4>
                {detail.syncLogs.length === 0 ? (
                  <p className="text-xs text-gray-400">Nessun log</p>
                ) : (
                  <div className="space-y-1">
                    {detail.syncLogs.map((l, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px]">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${l.status === "success" ? "bg-emerald-500" : "bg-red-500"}`} />
                        <span className="text-gray-600">{l.direction === "inbound" ? "\u2193" : "\u2191"} {l.event}</span>
                        <span className="text-gray-400 ml-auto">{fmtDateTime(l.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Failed jobs */}
              {detail.failedJobs.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-semibold text-red-600 uppercase tracking-wide mb-2">Job falliti</h4>
                  {detail.failedJobs.map((j) => (
                    <div key={j.id} className="text-xs bg-red-50 rounded-lg p-2 mb-1">
                      <p className="font-medium text-red-700">{j.type} \u2014 {j.attempts} tentativi</p>
                      <p className="text-red-500 text-[10px]">{j.lastError}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>;
}

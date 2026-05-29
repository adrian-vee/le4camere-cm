"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import ReservationForm from "../../components/reservation-form";
import { useToast } from "../../components/toast";

interface Reservation {
  id: string;
  externalReservationId: string;
  guest: string;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  guestCountry: string | null;
  checkIn: string;
  checkOut: string;
  roomType: string;
  roomTypeCode: string;
  channel: string;
  channelId: string;
  totalPrice: number;
  currency: string;
  status: string;
  adults: number;
  children: number;
  createdAt: string;
}

interface PageData {
  data: Reservation[];
  total: number;
  page: number;
  totalPages: number;
}

const CHANNEL_BADGE: Record<string, { letter: string; cls: string }> = {
  booking: { letter: "B", cls: "bg-[#003580] text-white" },
  direct: { letter: "D", cls: "bg-emerald-500 text-white" },
  expedia: { letter: "E", cls: "bg-amber-500 text-white" },
  airbnb: { letter: "A", cls: "bg-teal-500 text-white" },
  other: { letter: "?", cls: "bg-gray-400 text-white" },
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  confirmed: { label: "Confermata", cls: "bg-emerald-100 text-emerald-700" },
  modified: { label: "Modificata", cls: "bg-amber-100 text-amber-700" },
  cancelled: { label: "Cancellata", cls: "bg-red-100 text-red-700" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtEur(n: number) {
  return n.toLocaleString("it-IT", { minimumFractionDigits: 2 }) + " \u20AC";
}

type SortField = "checkIn" | "checkOut" | "guest" | "totalPrice" | "createdAt";

export default function PrenotazioniPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <PrenotazioniContent />
    </Suspense>
  );
}

function PrenotazioniContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [pageData, setPageData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterChannel, setFilterChannel] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [searchText, setSearchText] = useState(searchParams.get("search") ?? "");
  const [sortField, setSortField] = useState<SortField>("checkIn");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(searchParams.get("new") === "1");
  const [cancelling, setCancelling] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "20");
    if (filterStatus) params.set("status", filterStatus);
    if (filterChannel) params.set("channel", filterChannel);
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);
    if (searchText) params.set("search", searchText);

    try {
      const res = await fetch(`/api/prenotazioni?${params}`);
      if (!res.ok) throw new Error("Errore");
      setPageData(await res.json());
    } catch {
      toast("Errore caricamento prenotazioni", "error");
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterChannel, filterFrom, filterTo, searchText, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  // Client-side sort (since API returns paginated data)
  const sortedData = (pageData?.data ?? []).slice().sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortField === "totalPrice") return (a.totalPrice - b.totalPrice) * dir;
    const va = a[sortField] ?? "";
    const vb = b[sortField] ?? "";
    return va.localeCompare(vb) * dir;
  });

  const handleCancel = async (id: string) => {
    if (!confirm("Sei sicuro di voler cancellare questa prenotazione?")) return;
    setCancelling(id);
    try {
      const res = await fetch(`/api/prenotazioni/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        toast(err.error ?? "Errore nella cancellazione", "error");
        return;
      }
      toast("Prenotazione cancellata", "success");
      await fetchData();
    } catch {
      toast("Errore di rete", "error");
    } finally {
      setCancelling(null);
    }
  };

  const handleExportCSV = () => {
    if (!pageData) return;
    const headers = ["Ospite", "Check-in", "Check-out", "Camera", "Canale", "Importo", "Stato", "Creata il"];
    const rows = pageData.data.map((r) => [
      r.guest,
      r.checkIn,
      r.checkOut,
      r.roomType,
      r.channel,
      r.totalPrice.toFixed(2),
      r.status,
      r.createdAt.slice(0, 10),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prenotazioni-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-gray-300 ml-0.5">&uarr;&darr;</span>;
    return <span className="text-blue-600 ml-0.5">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Prenotazioni</h2>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 font-medium text-gray-600">
            Esporta CSV
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Nuova
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end bg-white rounded-xl border border-gray-200 p-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] text-gray-500 mb-0.5">Cerca</label>
          <input
            type="text"
            placeholder="Nome ospite..."
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setPage(1); }}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white"
          />
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 mb-0.5">Stato</label>
          <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white">
            <option value="">Tutti</option>
            <option value="confirmed">Confermata</option>
            <option value="modified">Modificata</option>
            <option value="cancelled">Cancellata</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 mb-0.5">Canale</label>
          <select value={filterChannel} onChange={(e) => { setFilterChannel(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white">
            <option value="">Tutti</option>
            <option value="booking">Booking</option>
            <option value="direct">Diretto</option>
            <option value="expedia">Expedia</option>
            <option value="airbnb">Airbnb</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 mb-0.5">Dal</label>
          <input type="date" value={filterFrom} onChange={(e) => { setFilterFrom(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 mb-0.5">Al</label>
          <input type="date" value={filterTo} onChange={(e) => { setFilterTo(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
        </div>
        {(filterStatus || filterChannel || filterFrom || filterTo || searchText) && (
          <button onClick={() => { setFilterStatus(""); setFilterChannel(""); setFilterFrom(""); setFilterTo(""); setSearchText(""); setPage(1); }}
            className="text-xs text-blue-600 hover:underline pb-1.5">
            Pulisci
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton />
      ) : !pageData || pageData.data.length === 0 ? (
        <div className="text-gray-400 bg-white rounded-xl border border-gray-200 p-10 text-center text-sm">
          Nessuna prenotazione trovata
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left">
                    <th className="w-8 px-3 py-2.5" />
                    <th className="px-3 py-2.5 font-semibold text-gray-600 text-xs cursor-pointer select-none" onClick={() => handleSort("checkIn")}>
                      Arrivo <SortIcon field="checkIn" />
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-gray-600 text-xs cursor-pointer select-none" onClick={() => handleSort("checkOut")}>
                      Partenza <SortIcon field="checkOut" />
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-gray-600 text-xs">Camera</th>
                    <th className="px-3 py-2.5 font-semibold text-gray-600 text-xs cursor-pointer select-none" onClick={() => handleSort("guest")}>
                      Ospite <SortIcon field="guest" />
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-gray-600 text-xs">Canale</th>
                    <th className="px-3 py-2.5 font-semibold text-gray-600 text-xs">Stato</th>
                    <th className="px-3 py-2.5 font-semibold text-gray-600 text-xs text-right cursor-pointer select-none" onClick={() => handleSort("totalPrice")}>
                      Importo <SortIcon field="totalPrice" />
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-gray-600 text-xs cursor-pointer select-none" onClick={() => handleSort("createdAt")}>
                      Creata <SortIcon field="createdAt" />
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-gray-600 text-xs">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map((r) => {
                    const chBadge = CHANNEL_BADGE[r.channel] ?? CHANNEL_BADGE.other;
                    const stBadge = STATUS_BADGE[r.status] ?? { label: r.status, cls: "bg-gray-100 text-gray-600" };
                    const isExpanded = expandedId === r.id;

                    return (
                      <RowGroup key={r.id}>
                        <tr className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${isExpanded ? "bg-gray-50/50" : ""}`}>
                          <td className="px-3 py-2.5">
                            <button onClick={() => setExpandedId(isExpanded ? null : r.id)}
                              className="text-gray-400 hover:text-gray-700 transition-colors">
                              <svg className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                              </svg>
                            </button>
                          </td>
                          <td className="px-3 py-2.5 text-gray-700 font-mono text-xs">{fmtDate(r.checkIn)}</td>
                          <td className="px-3 py-2.5 text-gray-700 font-mono text-xs">{fmtDate(r.checkOut)}</td>
                          <td className="px-3 py-2.5 text-gray-700 text-xs">{r.roomType}</td>
                          <td className="px-3 py-2.5">
                            <Link href={`/prenotazioni/${r.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                              {r.guest}
                            </Link>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${chBadge.cls}`}>
                              {chBadge.letter}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${stBadge.cls}`}>
                              {stBadge.label}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold text-gray-800">
                            {fmtEur(r.totalPrice)}
                          </td>
                          <td className="px-3 py-2.5 text-gray-500 text-xs">
                            {fmtDate(r.createdAt)}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1">
                              <Link href={`/prenotazioni/${r.id}`}
                                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700" title="Dettagli">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                </svg>
                              </Link>
                              {r.status !== "cancelled" && (
                                <button
                                  onClick={() => handleCancel(r.id)}
                                  disabled={cancelling === r.id}
                                  className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 disabled:opacity-50"
                                  title="Cancella"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-gray-50/80 border-b border-gray-100">
                            <td colSpan={10} className="px-6 py-3">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                <div>
                                  <p className="text-gray-400 mb-0.5">ID Esterno</p>
                                  <p className="font-mono text-gray-700">{r.externalReservationId}</p>
                                </div>
                                <div>
                                  <p className="text-gray-400 mb-0.5">Email</p>
                                  <p className="text-gray-700">{r.guestEmail ?? "—"}</p>
                                </div>
                                <div>
                                  <p className="text-gray-400 mb-0.5">Telefono</p>
                                  <p className="text-gray-700">{r.guestPhone ?? "—"}</p>
                                </div>
                                <div>
                                  <p className="text-gray-400 mb-0.5">Paese</p>
                                  <p className="text-gray-700">{r.guestCountry ?? "—"}</p>
                                </div>
                                <div>
                                  <p className="text-gray-400 mb-0.5">Adulti / Bambini</p>
                                  <p className="text-gray-700">{r.adults} / {r.children}</p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </RowGroup>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pageData.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                {pageData.total} prenotazioni — pagina {pageData.page} di {pageData.totalPages}
              </p>
              <div className="flex gap-1">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">
                  Precedente
                </button>
                <button disabled={page >= pageData.totalPages} onClick={() => setPage(page + 1)}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">
                  Successiva
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <ReservationForm open={showForm} onClose={() => setShowForm(false)} onCreated={() => { fetchData(); setShowForm(false); }} />
    </div>
  );
}

function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function TableSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="h-10 skeleton" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-12 skeleton border-t border-gray-50" />
      ))}
    </div>
  );
}

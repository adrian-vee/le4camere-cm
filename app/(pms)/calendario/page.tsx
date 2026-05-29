"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import ReservationForm from "../../components/reservation-form";
import { useToast } from "../../components/toast";

interface RoomReservation {
  id: string;
  guest: string;
  guestShort: string;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
  status: string;
  channel: string;
}

interface RoomRow {
  id: string;
  label: string;
  roomType: string;
  roomTypeCode: string;
  roomTypeId: string;
  reservations: RoomReservation[];
  stopSellDates: string[];
}

interface CalendarData {
  rooms: RoomRow[];
  dates: string[];
}

const CHANNEL_COLORS: Record<string, string> = {
  booking: "#003580",
  direct: "#22C55E",
  expedia: "#F59E0B",
  airbnb: "#14B8A6",
  other: "#94A3B8",
};

const ROOM_TYPES_ALL = [
  { code: "", label: "Tutte le camere" },
  { code: "DBL-STD", label: "Doppia Standard" },
  { code: "MAT-SUP", label: "Matrimoniale Superior" },
  { code: "TRP", label: "Tripla" },
  { code: "SGL", label: "Singola" },
];

function getToday(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
}

function fmtEur(n: number): string {
  return n.toLocaleString("it-IT", { minimumFractionDigits: 0 }) + "\u00A0\u20AC";
}

export default function CalendarioPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(getToday);
  const [filterType, setFilterType] = useState("");
  const [viewMode, setViewMode] = useState<"rooms" | "types">("rooms");
  const [showForm, setShowForm] = useState(false);
  const [preselectedCode, setPreselectedCode] = useState<string | undefined>();
  const [preselectedDate, setPreselectedDate] = useState<string | undefined>();

  const today = useMemo(getToday, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start: startDate,
        days: "30",
        view: viewMode,
      });
      if (filterType) params.set("roomType", filterType);
      const res = await fetch(`/api/calendario?${params}`);
      if (!res.ok) throw new Error("Errore");
      const json = await res.json();
      if (viewMode === "rooms") {
        setData(json);
      } else {
        // types view returns array directly — wrap for compatibility
        setData({ rooms: [], dates: json[0]?.days?.map((d: { date: string }) => d.date) ?? [] });
      }
    } catch {
      toast("Errore caricamento calendario", "error");
    } finally {
      setLoading(false);
    }
  }, [startDate, viewMode, filterType, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const navigate = (dir: number) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + dir * 14);
    setStartDate(d.toISOString().slice(0, 10));
  };

  const goToday = () => setStartDate(getToday());

  const handleCellClick = (roomCode: string, date: string) => {
    setPreselectedCode(roomCode);
    setPreselectedDate(date);
    setShowForm(true);
  };

  const handleBarClick = (reservationId: string) => {
    router.push(`/prenotazioni/${reservationId}`);
  };

  const dates = data?.dates ?? [];

  // Build events for "Prossimi eventi" section
  const upcomingEvents = useMemo(() => {
    if (!data) return [];
    const evts: Array<{ id: string; guest: string; roomType: string; type: string; date: string; room: string }> = [];
    for (const room of data.rooms) {
      for (const res of room.reservations) {
        if (res.checkIn === today || res.checkIn === nextDay(today)) {
          evts.push({ id: res.id, guest: res.guest, roomType: room.roomType, type: "checkin", date: res.checkIn, room: room.label });
        }
        if (res.checkOut === today || res.checkOut === nextDay(today)) {
          evts.push({ id: res.id, guest: res.guest, roomType: room.roomType, type: "checkout", date: res.checkOut, room: room.label });
        }
      }
    }
    return evts.sort((a, b) => a.date.localeCompare(b.date));
  }, [data, today]);

  // Get the month label for the header
  const monthLabel = useMemo(() => {
    if (dates.length === 0) return "";
    const first = new Date(dates[0]);
    const last = new Date(dates[dates.length - 1]);
    const fmt = (d: Date) => d.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
    if (first.getMonth() === last.getMonth()) return fmt(first);
    return `${fmt(first)} — ${fmt(last)}`;
  }, [dates]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Calendario</h2>
          <p className="text-xs text-gray-500 capitalize">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("rooms")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === "rooms" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
            >Camere</button>
            <button
              onClick={() => setViewMode("types")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === "types" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
            >Tipologie</button>
          </div>
          {/* Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-white"
          >
            {ROOM_TYPES_ALL.map((rt) => (
              <option key={rt.code} value={rt.code}>{rt.label}</option>
            ))}
          </select>
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">&larr;</button>
            <button onClick={goToday} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 font-medium">Oggi</button>
            <button onClick={() => navigate(1)} className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">&rarr;</button>
          </div>
        </div>
      </div>

      {loading ? (
        <CalendarSkeleton />
      ) : viewMode === "rooms" && data ? (
        <>
          {/* Room calendar grid */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto cal-scroll">
              <table className="w-max min-w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="sticky left-0 z-20 bg-gray-50 px-3 py-2 text-left font-semibold text-gray-600 min-w-[180px] border-r border-gray-200">
                      Camera
                    </th>
                    {dates.map((date) => {
                      const d = new Date(date);
                      const isWeekend = [0, 6].includes(d.getUTCDay());
                      const isToday = date === today;
                      const dayNum = d.getUTCDate();
                      const wd = d.toLocaleDateString("it-IT", { weekday: "short" }).slice(0, 3);
                      return (
                        <th
                          key={date}
                          className={`px-0 py-1.5 text-center min-w-[44px] w-[44px] ${isWeekend ? "bg-blue-50/40" : ""} ${isToday ? "bg-blue-50" : ""}`}
                        >
                          <div className="text-[10px] text-gray-400 uppercase">{wd}</div>
                          <div className={`text-xs font-semibold ${isToday ? "text-white bg-blue-600 w-6 h-6 rounded-full inline-flex items-center justify-center mx-auto" : "text-gray-700"}`}>
                            {dayNum}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {data.rooms.map((room, roomIdx) => {
                    const prevRoom = roomIdx > 0 ? data.rooms[roomIdx - 1] : null;
                    const showGroupHeader = !prevRoom || prevRoom.roomTypeCode !== room.roomTypeCode;

                    return (
                      <RoomCalendarRow
                        key={room.id}
                        room={room}
                        dates={dates}
                        today={today}
                        showGroupHeader={showGroupHeader}
                        onBarClick={handleBarClick}
                        onCellClick={handleCellClick}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-[11px] text-gray-500 flex-wrap">
            {Object.entries(CHANNEL_COLORS).filter(([k]) => k !== "other").map(([ch, color]) => (
              <span key={ch} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm" style={{ background: color }} />
                <span className="capitalize">{ch === "direct" ? "Diretto" : ch}</span>
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-gray-400" />
              Altro
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm hatch-pattern border border-gray-200" />
              Stop sell
            </span>
          </div>

          {/* Upcoming events */}
          {upcomingEvents.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Prossimi eventi</h3>
              <div className="flex flex-wrap gap-2">
                {upcomingEvents.slice(0, 10).map((ev, i) => (
                  <button
                    key={`${ev.id}-${ev.type}-${i}`}
                    onClick={() => router.push(`/prenotazioni/${ev.id}`)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                      ev.type === "checkin" ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"
                    }`}>
                      {ev.type === "checkin" ? "IN" : "OUT"}
                    </span>
                    <div>
                      <p className="text-xs font-medium text-gray-900">{ev.guest}</p>
                      <p className="text-[10px] text-gray-500">{ev.room}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-gray-400 text-sm text-center py-8">Vista tipologie in sviluppo — usa la vista Camere</div>
      )}

      <ReservationForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onCreated={() => { fetchData(); setShowForm(false); }}
        preselectedRoomTypeCode={preselectedCode}
        preselectedDate={preselectedDate}
      />
    </div>
  );
}

function RoomCalendarRow({
  room,
  dates,
  today,
  showGroupHeader,
  onBarClick,
  onCellClick,
}: {
  room: RoomRow;
  dates: string[];
  today: string;
  showGroupHeader: boolean;
  onBarClick: (id: string) => void;
  onCellClick: (code: string, date: string) => void;
}) {
  // Pre-compute which dates are covered by reservations
  const dateCoverage = useMemo(() => {
    const map = new Map<string, RoomReservation>();
    for (const res of room.reservations) {
      for (const date of dates) {
        if (date >= res.checkIn && date < res.checkOut) {
          map.set(date, res);
        }
      }
    }
    return map;
  }, [room.reservations, dates]);

  // Find bar segments: start cells for each reservation
  const barStarts = useMemo(() => {
    const starts = new Map<string, { res: RoomReservation; startIdx: number; span: number }>();
    for (const res of room.reservations) {
      const startIdx = Math.max(dates.indexOf(res.checkIn), res.checkIn < dates[0] ? 0 : -1);
      if (startIdx < 0) continue;
      const endIdx = dates.indexOf(res.checkOut);
      const effectiveEnd = endIdx >= 0 ? endIdx : (res.checkOut > dates[dates.length - 1] ? dates.length : -1);
      if (effectiveEnd < 0) continue;
      const span = effectiveEnd - startIdx;
      if (span <= 0) continue;
      const startDate = dates[startIdx];
      starts.set(startDate, { res, startIdx, span });
    }
    return starts;
  }, [room.reservations, dates]);

  const stopSellSet = useMemo(() => new Set(room.stopSellDates), [room.stopSellDates]);

  return (
    <>
      {showGroupHeader && (
        <tr className="bg-gray-50/80">
          <td colSpan={dates.length + 1} className="sticky left-0 z-10 px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
            {room.roomType}
          </td>
        </tr>
      )}
      <tr className="border-b border-gray-100 group hover:bg-gray-50/30">
        <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50/30 px-3 py-0 border-r border-gray-200 transition-colors">
          <div className="text-xs font-medium text-gray-900">{room.label}</div>
          <div className="text-[10px] text-gray-400">{room.roomTypeCode}</div>
        </td>
        {dates.map((date, dateIdx) => {
          const isWeekend = [0, 6].includes(new Date(date).getUTCDay());
          const isToday = date === today;
          const isStopSell = stopSellSet.has(date);
          const coveredRes = dateCoverage.get(date);
          const barStart = barStarts.get(date);

          // If this cell is covered by a reservation but not the start, render empty (bar spans over it)
          if (coveredRes && !barStart) {
            return (
              <td key={date} className={`px-0 py-0 h-[40px] border-r border-gray-50 ${isWeekend ? "bg-blue-50/20" : ""} ${isToday ? "bg-blue-50/40" : ""}`} />
            );
          }

          // If this cell starts a bar
          if (barStart) {
            const color = CHANNEL_COLORS[barStart.res.channel] ?? CHANNEL_COLORS.other;
            return (
              <td
                key={date}
                colSpan={barStart.span}
                className={`px-0 py-0.5 h-[40px] ${isToday ? "bg-blue-50/40" : ""}`}
              >
                <button
                  onClick={() => onBarClick(barStart.res.id)}
                  className="w-full h-[32px] rounded-md text-white text-[10px] font-medium px-2 flex items-center overflow-hidden whitespace-nowrap hover:brightness-110 transition-all shadow-sm cursor-pointer"
                  style={{ background: color }}
                  title={`${barStart.res.guest}: ${barStart.res.checkIn} \u2192 ${barStart.res.checkOut}`}
                >
                  <span className="truncate">{barStart.res.guestShort} {fmtEur(barStart.res.totalPrice)}</span>
                </button>
              </td>
            );
          }

          // Empty cell
          return (
            <td
              key={date}
              className={`px-0 py-0 h-[40px] border-r border-gray-50 cursor-pointer hover:bg-blue-50 transition-colors ${
                isStopSell ? "hatch-pattern" : ""
              } ${isWeekend ? "bg-blue-50/20" : ""} ${isToday ? "bg-blue-50/40" : ""}`}
              onClick={() => onCellClick(room.roomTypeCode, date)}
            />
          );
        })}
      </tr>
    </>
  );
}

function nextDay(dateStr: string): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function CalendarSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="space-y-0">
        <div className="h-10 skeleton" />
        {Array.from({ length: 13 }).map((_, i) => (
          <div key={i} className="h-[40px] skeleton" style={{ opacity: 1 - i * 0.05 }} />
        ))}
      </div>
    </div>
  );
}

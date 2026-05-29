"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import { useToast } from "../../components/toast";

interface DayRate {
  date: string;
  price: number;
  minStay: number | null;
  closedToArrival: boolean;
  closedToDeparture: boolean;
}

interface RatePlanRow {
  id: string;
  name: string;
  code: string;
  roomType: string;
  roomTypeCode: string;
  currency: string;
  days: DayRate[];
}

function getToday(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
}

export default function TariffePage() {
  const [data, setData] = useState<RatePlanRow[]>([]);
  const [startDate, setStartDate] = useState(getToday);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editCell, setEditCell] = useState<{ rpId: string; date: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [bulkForm, setBulkForm] = useState({ ratePlanId: "", dateFrom: "", dateTo: "", price: "", minStay: "" });
  const { toast } = useToast();

  const today = getToday();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tariffe?start=${startDate}&days=30`);
      if (!res.ok) throw new Error("Errore");
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [startDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const navigate = (dir: number) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + dir * 14);
    setStartDate(d.toISOString().slice(0, 10));
  };

  const saveCell = async (rpId: string, date: string, field: string, value: string) => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { ratePlanId: rpId, date };
      if (field === "price") body.price = parseFloat(value);
      else if (field === "minStay") body.minStay = value ? parseInt(value, 10) : null;

      const res = await fetch("/api/tariffe", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error("Errore");
      toast("Tariffa aggiornata", "success");
      await fetchData();
    } catch {
      toast("Errore salvataggio", "error");
    } finally {
      setSaving(false);
      setEditCell(null);
    }
  };

  const handleBulkApply = async () => {
    if (!bulkForm.ratePlanId || !bulkForm.dateFrom || !bulkForm.dateTo) {
      toast("Seleziona piano e date", "error");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        ratePlanId: bulkForm.ratePlanId,
        dateFrom: bulkForm.dateFrom,
        dateTo: bulkForm.dateTo,
      };
      if (bulkForm.price) body.price = parseFloat(bulkForm.price);
      if (bulkForm.minStay) body.minStay = parseInt(bulkForm.minStay, 10);

      const res = await fetch("/api/tariffe/bulk", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      toast(`${result.updatedDays} giorni aggiornati`, "success");
      setShowBulk(false);
      await fetchData();
    } catch (e) {
      toast(String(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const dates = data[0]?.days.map((d) => d.date) ?? [];

  const monthLabel = dates.length > 0
    ? new Date(dates[0]).toLocaleDateString("it-IT", { month: "long", year: "numeric" })
    : "";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Tariffe</h2>
          <p className="text-xs text-gray-500 capitalize">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowBulk(!showBulk)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 font-medium text-gray-600">
            Modifica a periodo
          </button>
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">&larr;</button>
            <button onClick={() => setStartDate(getToday())} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 font-medium">Oggi</button>
            <button onClick={() => navigate(1)} className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">&rarr;</button>
          </div>
        </div>
      </div>

      {/* Bulk editor */}
      {showBulk && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Modifica massiva tariffe</h3>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Piano tariffario</label>
              <select value={bulkForm.ratePlanId} onChange={(e) => setBulkForm({ ...bulkForm, ratePlanId: e.target.value })}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white">
                <option value="">Seleziona...</option>
                {data.map((rp) => <option key={rp.id} value={rp.id}>{rp.roomType} — {rp.code}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Dal</label>
              <input type="date" value={bulkForm.dateFrom} onChange={(e) => setBulkForm({ ...bulkForm, dateFrom: e.target.value })}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Al</label>
              <input type="date" value={bulkForm.dateTo} onChange={(e) => setBulkForm({ ...bulkForm, dateTo: e.target.value })}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Prezzo (\u20AC)</label>
              <input type="number" step="0.01" value={bulkForm.price} onChange={(e) => setBulkForm({ ...bulkForm, price: e.target.value })}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-24" />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">MinStay</label>
              <input type="number" value={bulkForm.minStay} onChange={(e) => setBulkForm({ ...bulkForm, minStay: e.target.value })}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-20" />
            </div>
            <button onClick={handleBulkApply} disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Applicando..." : "Applica"}
            </button>
          </div>
        </div>
      )}

      <p className="text-[10px] text-gray-400">Clicca su un valore per modificarlo</p>

      {loading ? (
        <div className="h-[400px] skeleton rounded-xl" />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto cal-scroll">
            <table className="w-max min-w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="sticky left-0 bg-gray-50 z-10 px-3 py-2.5 text-left font-semibold text-gray-600 min-w-[180px] border-r border-gray-200">
                    Piano tariffario
                  </th>
                  {dates.map((date) => {
                    const d = new Date(date);
                    const isWeekend = [0, 6].includes(d.getUTCDay());
                    const isToday = date === today;
                    const wd = d.toLocaleDateString("it-IT", { weekday: "short" }).slice(0, 3);
                    const dayNum = d.getUTCDate();
                    return (
                      <th key={date} className={`px-0 py-1.5 text-center min-w-[52px] w-[52px] ${isWeekend ? "bg-blue-50/40" : ""} ${isToday ? "bg-blue-50" : ""}`}>
                        <div className="text-[10px] text-gray-400 uppercase">{wd}</div>
                        <div className={`text-xs ${isToday ? "text-blue-600 font-bold" : "text-gray-600"}`}>{dayNum}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {data.map((rp) => (
                  <Fragment key={rp.id}>
                    {/* Price row */}
                    <tr className="border-b border-gray-100">
                      <td className="sticky left-0 bg-white z-10 px-3 py-2 border-r border-gray-200" rowSpan={2}>
                        <div className="font-medium text-gray-900 text-xs">{rp.roomType}</div>
                        <div className="text-[10px] text-gray-400">{rp.code}</div>
                      </td>
                      {rp.days.map((day) => {
                        const isEditing = editCell?.rpId === rp.id && editCell.date === day.date && editCell.field === "price";
                        const isWeekend = [0, 6].includes(new Date(day.date).getUTCDay());
                        return (
                          <td key={day.date} className={`px-0.5 py-1 text-center ${isWeekend ? "bg-blue-50/20" : ""}`}>
                            {isEditing ? (
                              <input autoFocus type="number" step="0.01" value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => saveCell(rp.id, day.date, "price", editValue)}
                                onKeyDown={(e) => { if (e.key === "Enter") saveCell(rp.id, day.date, "price", editValue); if (e.key === "Escape") setEditCell(null); }}
                                className="w-12 text-center border border-blue-400 rounded px-1 py-0.5 text-xs" disabled={saving} />
                            ) : (
                              <button onClick={() => { setEditCell({ rpId: rp.id, date: day.date, field: "price" }); setEditValue(String(day.price)); }}
                                className="w-12 text-center hover:bg-blue-50 rounded px-1 py-1 text-xs font-mono text-gray-800 transition-colors font-semibold">
                                {day.price.toLocaleString("it-IT", { minimumFractionDigits: 0 })}
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                    {/* MinStay row */}
                    <tr className="border-b border-gray-200">
                      {rp.days.map((day) => {
                        const isEditing = editCell?.rpId === rp.id && editCell.date === day.date && editCell.field === "minStay";
                        return (
                          <td key={day.date} className="px-0.5 py-0.5 text-center">
                            {isEditing ? (
                              <input autoFocus type="number" value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => saveCell(rp.id, day.date, "minStay", editValue)}
                                onKeyDown={(e) => { if (e.key === "Enter") saveCell(rp.id, day.date, "minStay", editValue); if (e.key === "Escape") setEditCell(null); }}
                                className="w-10 text-center border border-blue-400 rounded px-1 py-0 text-[10px]" disabled={saving} />
                            ) : (
                              <button onClick={() => { setEditCell({ rpId: rp.id, date: day.date, field: "minStay" }); setEditValue(String(day.minStay ?? "")); }}
                                className="text-[10px] text-gray-400 hover:text-blue-600 transition-colors">
                                {day.minStay ? `min ${day.minStay}` : "\u2014"}
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

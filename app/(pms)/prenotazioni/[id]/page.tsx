"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useToast } from "../../../components/toast";

const ReceiptPDF = dynamic(() => import("./receipt-pdf"), { ssr: false });

interface ReservationDetail {
  id: string;
  externalReservationId: string;
  guest: { firstName: string; lastName: string; email: string | null; phone: string | null; country: string | null };
  checkIn: string;
  checkOut: string;
  roomType: string;
  roomTypeCode: string;
  roomTypeId: string;
  channel: string;
  channelId: string;
  totalPrice: number;
  currency: string;
  adults: number;
  children: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  documents: Array<{ id: string; number: string; type: string; amount: number; issuedAt: string }>;
  timeline: Array<{ event: string; status: string; direction: string; createdAt: string }>;
}

interface PDFData {
  number: string;
  reservation: { guest: string; checkIn: string; checkOut: string; roomType: string; totalPrice: number; currency: string; adults: number; children: number };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtEur(n: number) {
  return n.toLocaleString("it-IT", { minimumFractionDigits: 2 }) + " €";
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  confirmed: { label: "Confermata", cls: "bg-emerald-100 text-emerald-700" },
  modified: { label: "Modificata", cls: "bg-amber-100 text-amber-700" },
  cancelled: { label: "Cancellata", cls: "bg-red-100 text-red-700" },
};

export default function ReservationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<ReservationDetail | null>(null);
  const [pdfData, setPdfData] = useState<PDFData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string | number>>({});
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/prenotazioni/${id}`);
      if (!res.ok) throw new Error("Errore");
      const d = await res.json();
      setData(d);
      setEditForm({
        firstName: d.guest.firstName,
        lastName: d.guest.lastName,
        email: d.guest.email ?? "",
        phone: d.guest.phone ?? "",
        country: d.guest.country ?? "",
        checkIn: d.checkIn,
        checkOut: d.checkOut,
        totalPrice: d.totalPrice,
        adults: d.adults,
        children: d.children,
      });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/prenotazioni/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const err = await res.json();
        toast(err.error ?? "Errore nel salvataggio", "error");
        return;
      }
      toast("Prenotazione aggiornata", "success");
      setEditing(false);
      await fetchData();
    } catch {
      toast("Errore di rete", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Sei sicuro di voler cancellare questa prenotazione? L'inventario verra rilasciato.")) return;
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
    }
  };

  const handleGeneratePDF = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/prenotazioni/${id}/pdf`, { method: "POST" });
      if (!res.ok) throw new Error("Errore");
      const result = await res.json();
      setPdfData(result);
      toast(`Documento N. ${result.number} generato`, "success");
      await fetchData();
    } catch {
      toast("Errore generazione documento", "error");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="text-gray-500 py-8">Caricamento...</div>;
  if (!data) return <div className="text-red-600">Prenotazione non trovata</div>;

  const st = STATUS_MAP[data.status] ?? { label: data.status, cls: "bg-gray-100 text-gray-600" };

  return (
    <div className="space-y-5 max-w-3xl">
      <Link href="/prenotazioni" className="text-sm text-blue-600 hover:underline inline-block">&larr; Torna alle prenotazioni</Link>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{data.guest.firstName} {data.guest.lastName}</h2>
            <p className="text-xs text-gray-400">ID: {data.externalReservationId}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
        </div>

        <div className="p-6 space-y-5">
          {editing ? (
            /* Edit mode */
            <div className="grid grid-cols-2 gap-3 text-sm">
              <EditField label="Nome" value={String(editForm.firstName)} onChange={(v) => setEditForm({ ...editForm, firstName: v })} />
              <EditField label="Cognome" value={String(editForm.lastName)} onChange={(v) => setEditForm({ ...editForm, lastName: v })} />
              <EditField label="Email" value={String(editForm.email)} onChange={(v) => setEditForm({ ...editForm, email: v })} />
              <EditField label="Telefono" value={String(editForm.phone)} onChange={(v) => setEditForm({ ...editForm, phone: v })} />
              <EditField label="Paese" value={String(editForm.country)} onChange={(v) => setEditForm({ ...editForm, country: v })} />
              <EditField label="Check-in" value={String(editForm.checkIn)} onChange={(v) => setEditForm({ ...editForm, checkIn: v })} type="date" />
              <EditField label="Check-out" value={String(editForm.checkOut)} onChange={(v) => setEditForm({ ...editForm, checkOut: v })} type="date" />
              <EditField label="Importo (EUR)" value={String(editForm.totalPrice)} onChange={(v) => setEditForm({ ...editForm, totalPrice: parseFloat(v) || 0 })} type="number" />
              <EditField label="Adulti" value={String(editForm.adults)} onChange={(v) => setEditForm({ ...editForm, adults: parseInt(v) || 1 })} type="number" />
              <EditField label="Bambini" value={String(editForm.children)} onChange={(v) => setEditForm({ ...editForm, children: parseInt(v) || 0 })} type="number" />
              <div className="col-span-2 flex gap-2 pt-2">
                <button onClick={handleSave} disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Salvataggio..." : "Salva modifiche"}
                </button>
                <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annulla</button>
              </div>
            </div>
          ) : (
            /* View mode */
            <>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Field label="Check-in" value={fmtDate(data.checkIn)} />
                <Field label="Check-out" value={fmtDate(data.checkOut)} />
                <Field label="Tipologia camera" value={data.roomType} />
                <Field label="Canale" value={data.channel} />
                <Field label="Importo" value={fmtEur(data.totalPrice)} />
                <Field label="Adulti / Bambini" value={`${data.adults} / ${data.children}`} />
                <Field label="Email" value={data.guest.email ?? "—"} />
                <Field label="Telefono" value={data.guest.phone ?? "—"} />
                <Field label="Paese" value={data.guest.country ?? "—"} />
                <Field label="Creata il" value={fmtDateTime(data.createdAt)} />
              </div>
            </>
          )}

          {/* Documents */}
          {data.documents.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Documenti emessi</h3>
              <div className="space-y-1">
                {data.documents.map((doc) => (
                  <div key={doc.id} className="flex justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                    <span className="font-medium text-gray-700">N. {doc.number}</span>
                    <span className="text-gray-600">{fmtEur(doc.amount)}</span>
                    <span className="text-gray-400">{fmtDate(doc.issuedAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div>
            <h3 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Timeline</h3>
            <div className="space-y-1">
              <TimelineItem label="Creata" date={fmtDateTime(data.createdAt)} status="info" />
              {data.updatedAt !== data.createdAt && (
                <TimelineItem label="Ultima modifica" date={fmtDateTime(data.updatedAt)} status="info" />
              )}
              {data.timeline.map((t, i) => (
                <TimelineItem key={i} label={`${t.direction === "inbound" ? "↓" : "↑"} ${t.event}`} date={fmtDateTime(t.createdAt)} status={t.status === "success" ? "success" : "error"} />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-200">
            {data.status !== "cancelled" && !editing && (
              <>
                <button onClick={() => setEditing(true)}
                  className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                  Modifica
                </button>
                <button onClick={handleCancel}
                  className="px-4 py-2 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors">
                  Cancella prenotazione
                </button>
              </>
            )}
            <button onClick={handleGeneratePDF} disabled={generating}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors">
              {generating ? "Generazione..." : "Genera PDF"}
            </button>
            {pdfData && (
              <ReceiptPDF
                docNumber={pdfData.number}
                guest={pdfData.reservation.guest}
                checkIn={pdfData.reservation.checkIn}
                checkOut={pdfData.reservation.checkOut}
                roomType={pdfData.reservation.roomType}
                totalPrice={pdfData.reservation.totalPrice}
                currency={pdfData.reservation.currency}
                adults={pdfData.reservation.adults}
                children={pdfData.reservation.children}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="font-medium text-gray-900">{value}</p>
    </div>
  );
}

function EditField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-[11px] text-gray-500 mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" step={type === "number" ? "0.01" : undefined} />
    </div>
  );
}

function TimelineItem({ label, date, status }: { label: string; date: string; status: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`w-1.5 h-1.5 rounded-full ${status === "success" ? "bg-emerald-500" : status === "error" ? "bg-red-500" : "bg-gray-400"}`} />
      <span className="text-gray-700">{label}</span>
      <span className="text-gray-400 ml-auto">{date}</span>
    </div>
  );
}

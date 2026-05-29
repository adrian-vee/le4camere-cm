"use client";

import { useState, useEffect } from "react";
import { useToast } from "./toast";

interface RoomTypeOption {
  id: string;
  name: string;
  code: string;
}

interface ReservationFormProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  preselectedRoomTypeCode?: string;
  preselectedDate?: string;
}

export default function ReservationForm({
  open,
  onClose,
  onCreated,
  preselectedRoomTypeCode,
  preselectedDate,
}: ReservationFormProps) {
  const { toast } = useToast();
  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    roomTypeCode: preselectedRoomTypeCode ?? "",
    checkIn: preselectedDate ?? "",
    checkOut: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    country: "IT",
    adults: 2,
    children: 0,
    totalPrice: 0,
    notes: "",
  });

  useEffect(() => {
    if (open) {
      fetch("/api/calendario?days=1")
        .then((r) => r.json())
        .then((data: Array<{ id: string; name: string; code: string }>) => {
          setRoomTypes(data.map((rt) => ({ id: rt.id, name: rt.name, code: rt.code })));
        });
      setForm((f) => ({
        ...f,
        roomTypeCode: preselectedRoomTypeCode ?? f.roomTypeCode,
        checkIn: preselectedDate ?? f.checkIn,
      }));
    }
  }, [open, preselectedRoomTypeCode, preselectedDate]);

  if (!open) return null;

  const handleChange = (field: string, value: string | number) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.roomTypeCode || !form.checkIn || !form.checkOut || !form.firstName || !form.lastName) {
      toast("Compila tutti i campi obbligatori", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/prenotazioni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Errore nella creazione", "error");
        return;
      }
      toast("Prenotazione creata con successo", "success");
      onCreated();
      onClose();
      // Reset form
      setForm({
        roomTypeCode: "", checkIn: "", checkOut: "", firstName: "", lastName: "",
        email: "", phone: "", country: "IT", adults: 2, children: 0, totalPrice: 0, notes: "",
      });
    } catch {
      toast("Errore di rete", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Nuova prenotazione</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipologia camera *</label>
              <select
                value={form.roomTypeCode}
                onChange={(e) => handleChange("roomTypeCode", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                required
              >
                <option value="">Seleziona...</option>
                {roomTypes.map((rt) => (
                  <option key={rt.code} value={rt.code}>{rt.name} ({rt.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Check-in *</label>
              <input
                type="date"
                value={form.checkIn}
                onChange={(e) => handleChange("checkIn", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Check-out *</label>
              <input
                type="date"
                value={form.checkOut}
                onChange={(e) => handleChange("checkOut", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
              <input
                value={form.firstName}
                onChange={(e) => handleChange("firstName", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cognome *</label>
              <input
                value={form.lastName}
                onChange={(e) => handleChange("lastName", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Telefono</label>
              <input
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Paese</label>
              <input
                value={form.country}
                onChange={(e) => handleChange("country", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Adulti</label>
                <input
                  type="number" min={1}
                  value={form.adults}
                  onChange={(e) => handleChange("adults", parseInt(e.target.value) || 1)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Bambini</label>
                <input
                  type="number" min={0}
                  value={form.children}
                  onChange={(e) => handleChange("children", parseInt(e.target.value) || 0)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Prezzo totale (EUR)</label>
              <input
                type="number" step="0.01" min={0}
                value={form.totalPrice}
                onChange={(e) => handleChange("totalPrice", parseFloat(e.target.value) || 0)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Note</label>
              <textarea
                value={form.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
              Annulla
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Salvataggio..." : "Crea prenotazione"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import type {
  ConnectivityProvider,
  AvailabilityUpdate,
  RateUpdate,
  RestrictionUpdate,
  NormalizedReservation,
  PushResult,
} from "../provider";

export class MockAdapter implements ConnectivityProvider {
  readonly name = "mock";

  async pushAvailability(updates: AvailabilityUpdate[]): Promise<PushResult> {
    console.log("[mock] pushAvailability: " + updates.length + " righe");
    return { ok: true };
  }

  async pushRates(updates: RateUpdate[]): Promise<PushResult> {
    console.log("[mock] pushRates: " + updates.length + " righe");
    return { ok: true };
  }

  async pushRestrictions(updates: RestrictionUpdate[]): Promise<PushResult> {
    console.log("[mock] pushRestrictions: " + updates.length + " righe");
    return { ok: true };
  }

  async fetchReservations(): Promise<NormalizedReservation[]> {
    return [
      {
        externalReservationId: "MOCK-0001",
        status: "confirmed",
        roomTypeCode: "DBL-STD",
        checkIn: "2026-07-01",
        checkOut: "2026-07-04",
        guest: { firstName: "Mario", lastName: "Rossi", email: "mario@example.com", country: "IT" },
        totalPrice: 360,
        currency: "EUR",
        adults: 2,
        children: 0,
      },
    ];
  }

  async acknowledgeReservation(externalReservationId: string): Promise<PushResult> {
    console.log("[mock] ack " + externalReservationId);
    return { ok: true };
  }
}

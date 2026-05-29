export type ISODate = string;

export interface AvailabilityUpdate {
  roomTypeCode: string;
  date: ISODate;
  available: number;
  stopSell: boolean;
}

export interface RateUpdate {
  ratePlanCode: string;
  date: ISODate;
  price: number;
  currency: string;
}

export interface RestrictionUpdate {
  ratePlanCode: string;
  date: ISODate;
  minStay?: number;
  maxStay?: number;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
}

export interface NormalizedReservation {
  externalReservationId: string;
  status: "confirmed" | "modified" | "cancelled";
  roomTypeCode: string;
  checkIn: ISODate;
  checkOut: ISODate;
  guest: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    country?: string;
  };
  totalPrice: number;
  currency: string;
  adults: number;
  children: number;
  raw?: unknown;
}

export interface PushResult {
  ok: boolean;
  error?: string;
}

export interface ConnectivityProvider {
  readonly name: string;
  pushAvailability(updates: AvailabilityUpdate[]): Promise<PushResult>;
  pushRates(updates: RateUpdate[]): Promise<PushResult>;
  pushRestrictions(updates: RestrictionUpdate[]): Promise<PushResult>;
  fetchReservations(since?: ISODate): Promise<NormalizedReservation[]>;
  acknowledgeReservation(externalReservationId: string): Promise<PushResult>;
}

export class NotImplementedError extends Error {
  constructor(provider: string, method: string) {
    super("[" + provider + "] " + method + " non implementato: richiede specifiche/credenziali certificate.");
    this.name = "NotImplementedError";
  }
}

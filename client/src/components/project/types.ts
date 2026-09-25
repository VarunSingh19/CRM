export type Role = "admin" | "sales" | "ops";

export interface Offering {
  _id: string; section: string; name: string;
  cardTypes: string[]; promo: string[]; stream: string[]; produced: string[];
  incl: string; excl: string; dev: string; duration: string;
}

export interface Item {
  _id: string; projectId?: string;
  section: string; name: string; topic: string; projDesc: string; status: string;
  cardType: string; promo: string; stream: string; produced: string;
  incl: string; excl: string; dev: string; duration: string;
  qty: number; rate: number; amountOverride: number | "";
  discType: "amount" | "percent"; discValue: number;
  cardName: string; recDate: string; relDate: string; cardEnd: string; videoEnd: string; brandEnd: string;
  sortOrder?: number;
}

export interface PartnerRow {
  _id: string; name: string; type: string; contact: string;
  email: string; mobile: string; gstin: string; addr: string;
}

/** One person's association with one partner — see contact.model.ts. */
export interface ContactRow {
  _id: string; partnerId: string; partnerName: string;
  name: string; email: string; mobile: string; current: boolean;
}

/** One assignable staff member — see listAssignableUsers() in user.service.ts. */
export interface StaffRow {
  _id: string; name: string; role: Role;
}

/** Blank-safe accessor for the loosely-typed project document. */
export type ProjectMap = Record<string, any>;

import { Timestamp } from 'firebase/firestore';

export interface Player {
  id: string;
  name: string;
  email?: string;
  active: boolean;
  createdAt: Timestamp;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  active: boolean;
  createdAt: Timestamp;
}

export interface Staff {
  id: string;
  name: string;
  active: boolean;
  createdAt: Timestamp;
}

export type PaymentMethod = 'cash' | 'cash_app' | 'apple_pay' | 'venmo' | 'paypal' | 'chime' | 'credit';

export interface BuyIn {
  amount: number;
  method: PaymentMethod;
  timestamp: Timestamp;
}

export interface Session {
  id: string;
  date: Timestamp;
  locationId: string;
  staffIds: string[];
  status: 'scheduled' | 'active' | 'completed';
  totalBuyIn: number;
  totalPayout: number;
  createdAt: Timestamp;
}

export interface Payout {
  amount: number;
  method: PaymentMethod;
  timestamp: Timestamp;
}

export interface PlayerSessionEntry {
  id: string;
  sessionId: string;
  playerId: string;
  playerDisplayName: string;
  buyIns: BuyIn[];
  totalBuyIn: number;
  payouts: Payout[];
  totalPayout: number;
  netProfit: number;
  status: 'playing' | 'finished';
}

export interface StaffSessionEntry {
  id: string;
  sessionId: string;
  staffId: string;
  staffDisplayName: string;
  payoutAmount: number;
  method: PaymentMethod;
  notes?: string;
  createdAt: Timestamp;
}

export const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'cash_app', label: 'Cash App' },
  { id: 'apple_pay', label: 'Apple Pay' },
  { id: 'venmo', label: 'Venmo' },
  { id: 'paypal', label: 'PayPal' },
  { id: 'chime', label: 'Chime' },
  { id: 'credit', label: 'Credit' },
];

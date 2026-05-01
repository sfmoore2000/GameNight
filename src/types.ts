export interface Player {
  id: string;
  name: string;
  email?: string;
  active: boolean;
  createdAt: string;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  active: boolean;
  createdAt: string;
}

export interface Staff {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
}

export type PaymentMethod = 'cash' | 'cash_app' | 'apple_pay' | 'venmo' | 'paypal' | 'zelle' | 'credit';

export interface BuyIn {
  amount: number;
  method: PaymentMethod;
  timestamp: string;
}

export interface Session {
  id: string;
  date: string;
  locationId: string;
  staffIds: string[];
  status: 'scheduled' | 'active' | 'completed';
  totalBuyIn: number;
  totalPayout: number;
  createdAt: string;
}

export interface Payout {
  amount: number;
  method: PaymentMethod;
  timestamp: string;
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
  creditSettlements?: {
    amount: number;
    method: PaymentMethod;
    timestamp: string;
  }[];
  totalSettled?: number;
  adjustments?: {
    amount: number;
    reason: string;
    timestamp: string;
  }[];
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
  createdAt: string;
}

export const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'cash_app', label: 'Cash App' },
  { id: 'apple_pay', label: 'Apple Pay' },
  { id: 'venmo', label: 'Venmo' },
  { id: 'paypal', label: 'PayPal' },
  { id: 'zelle', label: 'Zelle' },
  { id: 'credit', label: 'Credit' },
];

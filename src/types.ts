/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string;
  username: string;
  avatar: string;
  coinBalance: number;
  gender: 'male' | 'female' | 'unspecified';
  country: string;
  language: string;
  rating: number;
}

export type TransactionType = 'recharge' | 'deduction' | 'gift_send' | 'gift_receive';

export interface CoinTransaction {
  id: string;
  userId: string;
  amount: number;
  type: TransactionType;
  description: string;
  createdAt: string;
}

export interface CallSession {
  id: string;
  callerId: string;
  receiverId: string;
  callerName: string;
  receiverName: string;
  startTime: string;
  endTime?: string;
  durationSeconds: number;
  totalCoinsSpent: number;
}

export interface Gift {
  id: string;
  name: string;
  icon: string;
  cost: number;
  animationClass: string;
}

export interface MatchFilters {
  gender: 'all' | 'male' | 'female';
  region: 'global' | 'north_america' | 'europe' | 'asia' | 'latin_america';
  minRating: number;
}

export const AVAILABLE_GIFTS: Gift[] = [
  { id: 'gift_rose', name: 'Rose', icon: '🌹', cost: 5, animationClass: 'animate-bounce' },
  { id: 'gift_heart', name: 'Heart', icon: '❤️', cost: 10, animationClass: 'animate-ping' },
  { id: 'gift_gem', name: 'Diamond', icon: '💎', cost: 50, animationClass: 'animate-pulse' },
  { id: 'gift_star', name: 'Star Sparkle', icon: '✨', cost: 100, animationClass: 'animate-spin' },
  { id: 'gift_rocket', name: 'Rocket Launch', icon: '🚀', cost: 500, animationClass: 'translate-y-[-100px] transition-transform duration-1000' },
];

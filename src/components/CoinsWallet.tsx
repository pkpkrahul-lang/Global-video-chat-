/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CreditCard, Sparkles, Plus, History, Check, Coins } from 'lucide-react';
import { CoinTransaction } from '../types';

interface CoinsWalletProps {
  coinBalance: number;
  transactions: CoinTransaction[];
  onRecharge: (amount: number, description: string) => Promise<void>;
}

const PACKAGES = [
  { id: 'pkg_1', coins: 100, price: 1.99, description: 'Starter Pack', popular: false },
  { id: 'pkg_2', coins: 500, price: 7.99, description: 'Popular Pack', popular: true },
  { id: 'pkg_3', coins: 1200, price: 14.99, description: 'Elite Explorer', popular: false },
  { id: 'pkg_4', coins: 3000, price: 34.99, description: 'Supreme Whale', popular: false },
];

export default function CoinsWallet({ coinBalance, transactions, onRecharge }: CoinsWalletProps) {
  const [selectedPack, setSelectedPack] = useState(PACKAGES[1]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Form states
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [holderName, setHolderName] = useState('Alex Traveler');

  const handlePurchase = async () => {
    setIsProcessing(true);
    // Simulate payment gateway delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    try {
      await onRecharge(selectedPack.coins, `Purchased ${selectedPack.coins} premium coins`);
      setIsProcessing(false);
      setPaymentSuccess(true);
      setTimeout(() => setPaymentSuccess(false), 3000);
    } catch (e) {
      console.error(e);
      setIsProcessing(false);
    }
  };

  return (
    <div id="wallet-container" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-100 shadow-2xl h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Coins className="text-amber-400 w-6 h-6 animate-pulse" />
            <h2 className="font-display font-semibold text-lg text-slate-100">Premium Wallet</h2>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs flex items-center gap-1 text-slate-400 hover:text-amber-400 border border-slate-800 hover:border-amber-400/20 px-2 py-1 rounded-lg transition"
          >
            <History className="w-3.5 h-3.5" />
            {showHistory ? 'Purchase Coins' : 'View Ledger'}
          </button>
        </div>

        {/* Balance Showcase */}
        <div className="bg-radial from-slate-800 to-slate-950 p-4 rounded-xl border border-slate-800 text-center mb-5">
          <span className="text-xs text-slate-400 font-mono tracking-wider uppercase">Available Coins</span>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="text-3xl font-display font-bold text-amber-400 tracking-tight">{coinBalance}</span>
            <span className="text-xl">🪙</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1 font-sans">10 coins/min standard matches • 15 coins/min premium filters</p>
        </div>

        {showHistory ? (
          /* Transaction Ledger */
          <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest font-mono mb-2">Transaction History</h3>
            {transactions.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">No coin transactions yet.</p>
            ) : (
              transactions.map((tx) => (
                <div key={tx.id} className="flex justify-between items-center text-xs p-2.5 rounded-lg bg-slate-950 border border-slate-850">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-slate-200">{tx.description}</span>
                    <span className="text-[10px] text-slate-500">{new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <span className={`font-mono font-semibold px-1.5 py-0.5 rounded text-[10px] ${
                    tx.amount > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                    {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                  </span>
                </div>
              ))
            )}
          </div>
        ) : (
          /* Coin packages */
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest font-mono mb-3">Recharge Packages</h3>
            <div className="grid grid-cols-2 gap-2.5 mb-5">
              {PACKAGES.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => setSelectedPack(pkg)}
                  className={`relative p-3 rounded-xl border text-left transition duration-250 flex flex-col justify-between h-[82px] outline-none ${
                    selectedPack.id === pkg.id
                      ? 'bg-amber-400/5 border-amber-400 text-slate-100 shadow-md shadow-amber-400/5'
                      : 'bg-slate-950 hover:bg-slate-900 border-slate-850 hover:border-slate-700 text-slate-400'
                  }`}
                >
                  {pkg.popular && (
                    <span className="absolute top-[-8px] right-2 bg-gradient-to-r from-amber-500 to-amber-600 text-[8px] text-slate-950 font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                      Popular
                    </span>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-100">{pkg.coins}</span>
                    <span className="text-xs">🪙</span>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 leading-tight">{pkg.description}</p>
                    <p className="text-xs font-semibold text-amber-400 mt-0.5">${pkg.price}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Payment checkout form */}
            <div className="bg-slate-950 rounded-xl p-3 border border-slate-850">
              <span className="text-[10px] text-slate-500 uppercase font-mono font-semibold tracking-wider flex items-center gap-1 mb-2">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                Sandbox Payment System
              </span>

              <div className="space-y-2">
                <div>
                  <label className="text-[9px] text-slate-400 block font-mono mb-0.5">Card Number</label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full text-xs font-mono bg-slate-900 border border-slate-800 rounded p-1 text-slate-200 outline-none focus:border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-slate-400 block font-mono mb-0.5">Cardholder Name</label>
                  <input
                    type="text"
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value)}
                    className="w-full text-xs bg-slate-900 border border-slate-800 rounded p-1 text-slate-200 outline-none focus:border-slate-700"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {!showHistory && (
        <div className="mt-4 pt-3 border-t border-slate-850">
          {paymentSuccess ? (
            <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs py-2 rounded-xl text-center flex items-center justify-center gap-2 font-medium">
              <Check className="w-4 h-4" /> Added +{selectedPack.coins} Coins! Enjoy Matching
            </div>
          ) : (
            <button
              onClick={handlePurchase}
              disabled={isProcessing}
              className={`w-full py-2.5 rounded-xl text-xs font-semibold tracking-wide cursor-pointer transition flex items-center justify-center gap-1.5 ${
                isProcessing
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-lg shadow-amber-400/15'
              }`}
            >
              {isProcessing ? (
                <>
                  <div className="w-3 h-3 border-2 border-slate-550 border-t-transparent rounded-full animate-spin" />
                  Securing payment...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-slate-950" />
                  Top Up {selectedPack.coins} Coins (${selectedPack.price})
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShieldCheck, Flame, HelpCircle, Sparkles, SlidersHorizontal, LogIn, ExternalLink } from 'lucide-react';
import { MatchFilters, User } from '../types';

interface Host {
  id: string;
  username: string;
  avatar: string;
  gender: string;
  country: string;
  language: string;
  rating: number;
  bio: string;
}

interface LobbyScreenProps {
  coinBalance: number;
  hosts: Host[];
  onStartMatching: (filters: MatchFilters) => void;
  onCallHost: (hostId: string, filters: MatchFilters) => void;
}

export default function LobbyScreen({ coinBalance, hosts, onStartMatching, onCallHost }: LobbyScreenProps) {
  const [filters, setFilters] = useState<MatchFilters>({
    gender: 'all',
    region: 'global',
    minRating: 4.5
  });
  const [showFilters, setShowFilters] = useState(false);

  // Compute total minute cost
  const baseRate = 10;
  let premiumRate = 0;
  if (filters.gender !== 'all') premiumRate += 5;
  if (filters.region !== 'global') premiumRate += 5;

  const totalRate = baseRate + premiumRate;

  return (
    <div id="lobby-container" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-100 shadow-2xl h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-1.5">
            <span className="text-xl">📻</span>
            <h2 className="font-display font-semibold text-lg text-slate-100">Match Lounge</h2>
          </div>
          <span className="text-[10px] bg-amber-400/10 text-amber-400 font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono flex items-center gap-1 animate-pulse">
            <Flame className="w-3 h-3 text-amber-400" />
            Live matches active
          </span>
        </div>

        {/* Hero Area */}
        <div className="p-4 bg-radial from-slate-850 to-slate-950 rounded-xl border border-slate-850 text-center mb-5">
          <p className="text-xs text-slate-400 max-w-sm mx-auto font-sans leading-relaxed">
            Connect instantly with verified people worldwide. Search randomly, or filter by specific criteria to customize your chatroom.
          </p>

          <div className="flex gap-2 justify-center mt-3 text-[10px] font-mono text-slate-500">
            <span className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-850">
              <ShieldCheck className="w-3 h-3 text-emerald-400" /> Encrypted Signaling
            </span>
            <span className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-850">
              ⚡ WebRTC Peer Streams
            </span>
          </div>
        </div>

        {/* Filter controls panel */}
        <div className="mb-5 bg-slate-950 rounded-xl border border-slate-850 overflow-hidden">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="w-full p-3 flex justify-between items-center text-xs text-slate-450 hover:text-amber-400 transition"
          >
            <span className="font-mono font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <SlidersHorizontal className="w-4 h-4 text-slate-400" />
              Configure Match Filters
            </span>
            <span className="text-[10px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-slate-450">
              {showFilters ? 'Collapse' : 'Expand Options'}
            </span>
          </button>

          {showFilters && (
            <div className="p-3 border-t border-slate-850 bg-slate-950/50 space-y-3.5">
              {/* Gender Criteria */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] uppercase font-semibold text-slate-400 font-mono tracking-wider">Matching Gender</label>
                  {filters.gender !== 'all' && <span className="text-[9px] text-amber-500 font-semibold font-mono">+5 coins/min</span>}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'all', label: 'All Genders' },
                    { id: 'female', label: 'Only Females' },
                    { id: 'male', label: 'Only Males' }
                  ].map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setFilters({ ...filters, gender: g.id as MatchFilters['gender'] })}
                      className={`py-1.5 text-[10px] font-semibold rounded-lg border transition cursor-pointer ${
                        filters.gender === g.id
                          ? 'bg-amber-400/5 border-amber-400 text-amber-400'
                          : 'bg-slate-900 border-slate-850 text-slate-400 hover:border-slate-80 border-dashed'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Region Criteria */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] uppercase font-semibold text-slate-400 font-mono tracking-wider">Target Region</label>
                  {filters.region !== 'global' && <span className="text-[9px] text-amber-500 font-semibold font-mono">+5 coins/min</span>}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'global', label: 'Worldwide' },
                    { id: 'europe', label: 'Europe 🇪🇺' },
                    { id: 'asia', label: 'Asia-Pac 🌏' }
                  ].map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setFilters({ ...filters, region: r.id as MatchFilters['region'] })}
                      className={`py-1.5 text-[10px] font-semibold rounded-lg border transition cursor-pointer ${
                        filters.region === r.id
                          ? 'bg-amber-400/5 border-amber-400 text-amber-400'
                          : 'bg-slate-900 border-slate-850 text-slate-400 hover:border-slate-80 border-dashed'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pricing tag */}
        <div className="bg-slate-950 p-2.5 rounded-xl border border-dotted border-slate-850 text-center mb-5 flex justify-between items-center">
          <span className="text-[10px] text-slate-500 font-mono">ESTIMATED RATE:</span>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-amber-400 font-mono">{totalRate}</span>
            <span className="text-xs">🪙</span>
            <span className="text-[10px] text-slate-400">/ minute</span>
          </div>
        </div>

        {/* Top Creators list */}
        <div>
          <h3 className="text-xs font-semibold text-slate-450 uppercase tracking-widest font-mono mb-2.5 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Verified Online Connectors
          </h3>
          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
            {hosts.map((host) => (
              <div key={host.id} className="flex justify-between items-center p-2 rounded-xl bg-slate-950 border border-slate-850 hover:border-slate-750 transition">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{host.avatar}</span>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold text-slate-100">{host.username}</span>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1 rounded flex items-center gap-0.5 leading-none">
                        ● Online
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-500">{host.country} • Speaks {host.language}</span>
                  </div>
                </div>
                <button
                  onClick={() => onCallHost(host.id, filters)}
                  className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-semibold rounded-lg px-2.5 py-1 text-[10px] transition cursor-pointer flex items-center gap-0.5"
                >
                  Call Now <LogIn className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 pt-3 border-t border-slate-850">
        <button
          onClick={() => onStartMatching(filters)}
          className="w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 text-xs font-semibold tracking-wide py-3 rounded-xl shadow-lg shadow-amber-400/10 transition cursor-pointer flex items-center justify-center gap-1.5"
        >
          <span>✨</span> Start Random Video Match <span>✨</span>
        </button>
      </div>
    </div>
  );
}

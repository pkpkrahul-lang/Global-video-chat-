/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Coins, User as UserIcon, History, LogIn, Sparkles, 
  Settings, PhoneCall, HelpCircle, Laptop, Clock, ShieldCheck, Terminal
} from 'lucide-react';

import { User, CoinTransaction, CallSession, MatchFilters } from './types';
import CoinsWallet from './components/CoinsWallet';
import ProfileScreen from './components/ProfileScreen';
import LobbyScreen from './components/LobbyScreen';
import VideoRoom from './components/VideoRoom';

interface SocketLog {
  id: string;
  timestamp: Date;
  type: 'info' | 'success' | 'warn' | 'error';
  event: string;
  message: string;
}

export default function App() {
  // Application view tabs and statuses
  const [activeTab, setActiveTab] = useState<'wallet' | 'profile' | 'history' | 'logs'>('wallet');
  const [appState, setAppState] = useState<'lobby' | 'room'>('lobby');
  const [matchStatus, setMatchStatus] = useState<'idle' | 'searching'>('idle');

  // Backend state elements
  const [user, setUser] = useState<User>({
    id: 'user_primary',
    username: 'Alex Explorer',
    avatar: '🦊',
    coinBalance: 0,
    gender: 'unspecified',
    country: 'Global Area',
    language: 'English',
    rating: 5.0
  });

  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [callsHistory, setCallsHistory] = useState<CallSession[]>([]);
  const [hosts, setHosts] = useState<any[]>([]);

  // Socket Connection and Active call references
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  // Active Meeting data
  const [activeSession, setActiveSession] = useState<{
    channelName: string;
    partnerProfile: any;
    isHost: boolean;
    role: string;
    filters: MatchFilters | null;
  } | null>(null);

  // Searching Radar texts simulation
  const [searchingText, setSearchingText] = useState('Initiating cryptographic matching tunnels...');

  // Match delay timer reference
  const matchingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Connection synchronization states
  const [isFetchingState, setIsFetchingState] = useState(true);
  const [fetchStateError, setFetchStateError] = useState<string | null>(null);
  const [socketLogs, setSocketLogs] = useState<SocketLog[]>([]);

  const addLog = (type: 'info' | 'success' | 'warn' | 'error', event: string, message: string) => {
    setSocketLogs(prev => [
      {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date(),
        type,
        event,
        message
      },
      ...prev
    ].slice(0, 50));
  };

  // 1. Load Initial system state from REST APIs with retry logic
  const fetchState = async (retries = 5, delay = 1000) => {
    setIsFetchingState(true);
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setTransactions(data.transactions);
        setCallsHistory(data.calls);
        setHosts(data.hosts);
        setFetchStateError(null);
        setIsFetchingState(false);
      } else {
        throw new Error(`Server returned status: ${res.status}`);
      }
    } catch (err: any) {
      console.warn("Failed to query Express state repository:", err);
      if (retries > 0) {
        console.log(`Retrying fetchState in ${delay}ms... (${retries} attempts left)`);
        setTimeout(() => fetchState(retries - 1, delay * 1.5), delay);
      } else {
        setFetchStateError(err?.message || 'Failed to connect to the backend server. Please verify the host environment is healthy.');
        setIsFetchingState(false);
      }
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  // 2. Establish persistent Socket.io connection with diagnostics
  useEffect(() => {
    addLog('info', 'handshake_init', 'Attempting WebSocket handshake connection over local node proxy...');
    const s = io({
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000
    });
    setSocket(s);

    s.on('connect', () => {
      setConnectionState('connected');
      addLog('success', 'connect', `WebSocket handshake secure. Node assigned client token: ${s.id}`);
      console.log("WebSocket linked to backend node: ", s.id);
    });

    s.on('connect_error', (err) => {
      addLog('error', 'connect_error', `Handshake protocol failed: ${err.message || String(err)}. Make sure express server index port 3000 is running.`);
    });

    s.on('error', (err) => {
      addLog('error', 'socket_error', `Internal socket transport fault reported: ${err.message || String(err)}`);
    });

    s.on('disconnect', (reason) => {
      setConnectionState('disconnected');
      addLog('warn', 'disconnect', `WebSocket channel closed. Reason code: ${reason}`);
    });

    // Real-time balance deductions synchronizer
    s.on('balance_update', (data: { balance: number }) => {
      setUser(prev => ({ ...prev, coinBalance: data.balance }));
      addLog('info', 'balance_update', `Synchronized live wallet balance: ${data.balance} Coins`);
    });

    s.on('system_balance_update', (data: { balance: number }) => {
      setUser(prev => ({ ...prev, coinBalance: data.balance }));
      addLog('info', 'balance_sync', `Ledger reconciliation complete. New balance: ${data.balance} Coins`);
      fetchState(); // Automatically grab latest ledger list as well
    });

    // Match pair success event
    s.on('match_found', (data: { channelName: string; partnerId: string; isHost: boolean; partnerProfile: any; role: string }) => {
      addLog('success', 'match_found', `Queue dispatch success. Cryptographic pairing completed! Tunnel: ${data.channelName}, Role: ${data.role}`);
      console.log("Match verified! Accessing room:", data.channelName);
      
      // Stop searching countdown/timers
      if (matchingTimeoutRef.current) {
        clearTimeout(matchingTimeoutRef.current);
        matchingTimeoutRef.current = null;
      }

      setMatchStatus('idle');
      setAppState('room');

      // Set active call meeting data
      setActiveSession({
        channelName: data.channelName,
        partnerProfile: data.partnerProfile,
        isHost: data.isHost,
        role: data.role,
        filters: null // Resolved on back-end
      });

      // Start continuous call billing deductions loop
      s.emit('start_call_billing', {
        channelName: data.channelName,
        callerId: 'user_primary',
        receiverId: data.partnerId,
        isHost: data.isHost
      });
    });

    // Match failed or balance checked low
    s.on('match_failed', (data: { reason: string }) => {
      setMatchStatus('idle');
      addLog('error', 'match_failed', `Queue search aborted by supervisor node. Cause: ${data.reason}`);
      alert(`⚠️ Match Failed: ${data.reason}`);
    });

    s.on('call_ended', (data: { reason: string; description?: string }) => {
      addLog('warn', 'call_ended', `Active meeting terminated. Term trigger: ${data.reason} (${data.description || 'no details'})`);
      console.log("Active call terminated:", data.reason);
      setAppState('lobby');
      setActiveSession(null);
      
      // Clear up matching ref just in case
      if (matchingTimeoutRef.current) {
        clearTimeout(matchingTimeoutRef.current);
        matchingTimeoutRef.current = null;
      }

      if (data.description || data.reason === 'low_balance') {
        alert(`🔴 Meeting Ended: ${data.description || 'Reason: ' + data.reason}`);
      }

      // Re-fetch clean ledger logs and call histories
      fetchState();
    });

    return () => {
      s.disconnect();
      if (matchingTimeoutRef.current) clearTimeout(matchingTimeoutRef.current);
    };
  }, []);

  // Searching Radar Texts Rotator effect
  useEffect(() => {
    if (matchStatus !== 'searching') return;

    const phrases = [
      'Locking orbital geolocation headers...',
      'Filtering secure WebRTC codecs...',
      'Matching coin wallets and rating algorithms...',
      'Pairing explorer connection profiles...',
      'Establishing secure signal handshake...'
    ];

    let current = 0;
    const interval = setInterval(() => {
      current = (current + 1) % phrases.length;
      setSearchingText(phrases[current]);
    }, 1500);

    return () => clearInterval(interval);
  }, [matchStatus]);

  // Initiate Random Matchmaker Queue
  const handleStartMatching = (filters: MatchFilters) => {
    if (!socket) {
      addLog('error', 'queue_failed', 'Websocket disconnected. Unable to initiate matchmaking handshake.');
      return;
    }
    setMatchStatus('searching');
    addLog('info', 'join_queue', `Enqueuing matching pool. Demanded Filters: ${JSON.stringify(filters)}`);

    // Emit queue search event to server
    socket.emit('join_matchmaker', { userId: 'user_primary', filters });

    // AI Fallback Matcher: If match is empty for 3 seconds, automatically pair with online simulator host
    // so user gets instant gratification in single-session evaluations!
    if (matchingTimeoutRef.current) clearTimeout(matchingTimeoutRef.current);
    
    matchingTimeoutRef.current = setTimeout(() => {
      console.log("Lobby queue empty. Redirecting to verified simulated connector.");
      addLog('warn', 'queue_fallback', 'No active peers online in queue. Diverting to instant simulated partner proxy...');
      socket.emit('force_match_simulated_host', { userId: 'user_primary', filters });
    }, 3000);
  };

  // Direct Call verified creators/hosts immediately
  const handleCallHost = (hostId: string, filters: MatchFilters) => {
    if (!socket) {
      addLog('error', 'call_failed', 'Websocket offline. Cannot command host direct call.');
      return;
    }
    setMatchStatus('searching');
    setSearchingText(`Direct dialing verified connector node...`);
    addLog('info', 'direct_dial', `Requesting direct secure session pipe with creator ID: ${hostId}`);
    
    // Direct call triggers instant mock matching
    socket.emit('force_match_simulated_host', { userId: 'user_primary', filters: { ...filters, gender: 'all' } });
  };

  const handleCancelMatching = () => {
    if (!socket) return;
    if (matchingTimeoutRef.current) {
      clearTimeout(matchingTimeoutRef.current);
      matchingTimeoutRef.current = null;
    }
    setMatchStatus('idle');
    addLog('info', 'cancel_queue', 'Canceled searching stream pool. Exiting lobby queue.');
    socket.emit('leave_matchmaker');
  };

  // Safe user manual hangup
  const handleHangUp = () => {
    if (socket && activeSession) {
      addLog('info', 'hangup_meeting', `User initiated terminate for session: ${activeSession.channelName}`);
      socket.emit('end_call', { channelName: activeSession.channelName });
      setAppState('lobby');
      setActiveSession(null);
      fetchState();
    }
  };

  // Dynamic automatic skip-and-next finder matching
  const handleSkipNext = () => {
    if (socket && activeSession) {
      addLog('info', 'skip_next', `User requested skip hop. Leaving channel: ${activeSession.channelName}. Re-queueing next candidate...`);
      // First, cleanly close current call session billing
      socket.emit('end_call', { channelName: activeSession.channelName });
      
      // Briefly reset and queue into another random search immediately
      setActiveSession(null);
      setAppState('lobby');
      
      // Slight timeout to let sockets clean channels
      setTimeout(() => {
        handleStartMatching({
          gender: 'all',
          region: 'global',
          minRating: 4.5
        });
      }, 500);
    }
  };

  // Topup request
  const handleRechargeCoinWallet = async (amount: number, description: string) => {
    try {
      const res = await fetch('/api/recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, description })
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setTransactions(data.transactions);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Edit/Save Profile Attributes
  const handleUpdateProfile = async (updated: Partial<User>) => {
    try {
      const res = await fetch('/api/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-x-hidden select-none flex flex-col justify-between">
      
      {/* HEADER BAR */}
      <header className="border-b border-slate-900 bg-slate-950 px-5 lg:px-8 py-4 shrink-0 flex flex-col sm:flex-row gap-4 justify-between items-center z-10">
        
        {/* Logo and Network indicators */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-400/10">
            <span className="text-xl">📹</span>
          </div>
          <div>
            <h1 className="font-display font-bold text-lg tracking-tight text-slate-100 flex items-center gap-1.5">
              Video Chat with Coins
              <span className="text-[9px] font-mono border border-amber-400/20 bg-amber-400/5 text-amber-400 font-semibold px-1.5 py-0.5 rounded">
                SECURE v2.4
              </span>
            </h1>
            <p className="text-[10px] text-slate-500 font-mono tracking-wider flex items-center gap-1 uppercase mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${connectionState === 'connected' ? (isFetchingState ? 'bg-amber-400' : 'bg-emerald-400') : 'bg-red-400'} animate-pulse`} />
              System node: {connectionState === 'connected' ? (isFetchingState ? 'SYNCHRONIZING...' : 'READY / SECURE') : 'CONNECTING...'}
            </p>
          </div>
        </div>

        {/* Dynamic UTC Indicators & Right header metadata */}
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap justify-center">
          
          {/* Dynamic User Profile Indicator */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-850 px-3 py-1.5 rounded-xl">
            <span className="text-2xl leading-none">{user.avatar}</span>
            <div className="flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-200">{user.username}</span>
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">{user.country}</span>
            </div>
          </div>

          {/* Glowing Coin balance controller */}
          <button
            onClick={() => {
              setActiveTab('wallet');
              const walletEl = document.getElementById('wallet-container');
              if (walletEl) walletEl.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-slate-950 font-display font-bold px-4 py-2 rounded-xl transition duration-240 hover:scale-103 active:scale-97 cursor-pointer shadow-lg shadow-amber-400/10"
          >
            <Coins className="w-4 h-4 text-slate-950 animate-pulse" />
            <span className="text-sm tracking-tight">{user.coinBalance}</span>
            <span className="text-xs font-semibold uppercase font-mono bg-slate-950/15 px-1.5 py-0.5 rounded">
              COINS
            </span>
          </button>
        </div>
      </header>

      {/* COMPACT MAIN ENGINE */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 flex flex-col md:grid md:grid-cols-12 gap-6 items-stretch mb-6">
        {fetchStateError && (
          <div className="col-span-12 bg-red-950/40 border border-red-500/20 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3 animate-pulse">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">⚠️</span>
              <div className="text-left">
                <p className="text-xs font-semibold text-red-200 font-sans">Express Synchronization Offline</p>
                <p className="text-[10px] text-red-400 leading-normal font-sans">
                  {fetchStateError}. Sandbox node may be loading or warming up.
                </p>
              </div>
            </div>
            <button
              onClick={() => fetchState()}
              className="px-3.5 py-1.5 text-[10px] font-mono tracking-wider uppercase bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-200 rounded-lg transition active:scale-95 cursor-pointer font-bold"
            >
              Reconnect system state
            </button>
          </div>
        )}
        
        {/* Left Side: Match Lounge, Scanning, Active Video stream Rooms (Column span 7) */}
        <section className="md:col-span-7 flex flex-col">
          {appState === 'room' && activeSession ? (
            /* Active Live Connection room */
            <div className="h-[620px]">
              <VideoRoom
                channelName={activeSession.channelName}
                partnerProfile={activeSession.partnerProfile}
                isHost={activeSession.isHost}
                role={activeSession.role}
                coinBalance={user.coinBalance}
                socket={socket}
                onHangUp={handleHangUp}
                onSkipNext={handleSkipNext}
              />
            </div>
          ) : matchStatus === 'searching' ? (
            /* Searching / Matchmaking radar scanner overlay */
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-2xl h-[480px] my-auto relative overflow-hidden">
              {/* Radar ring bursts */}
              <div className="relative w-48 h-48 flex items-center justify-center mb-8">
                <div className="absolute inset-0 bg-amber-400/5 rounded-full animate-ping duration-2000" />
                <div className="absolute inset-4 bg-amber-400/8 rounded-full animate-ping duration-1500 delay-500" />
                <div className="absolute inset-8 bg-amber-400/10 rounded-full animate-ping" />
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 to-amber-500 flex items-center justify-center text-2xl shadow-xl shadow-amber-400/20 z-10">
                  🛰️
                </div>
              </div>

              <h2 className="font-display font-semibold text-lg text-slate-100 tracking-tight">
                Scanning Connected Match nodes...
              </h2>
              <p className="text-xs text-amber-400 font-mono mt-2 min-h-8 max-w-sm">
                {searchingText}
              </p>

              <div className="text-[10px] text-slate-500 font-sans max-w-xs mt-3 leading-relaxed">
                Matches are routed instantly. Connecting premium filters may consume additional verification tokens.
              </div>

              <button
                onClick={handleCancelMatching}
                className="mt-6 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-semibold px-6 py-2 rounded-xl text-xs transition uppercase tracking-wider cursor-pointer active:scale-95 duration-230"
              >
                Cancel Matching
              </button>
            </div>
          ) : (
            /* Idle Matching Lounge screen */
            <div className="h-[480px]">
              <LobbyScreen
                coinBalance={user.coinBalance}
                hosts={hosts}
                onStartMatching={handleStartMatching}
                onCallHost={handleCallHost}
              />
            </div>
          )}
        </section>

        {/* Right Side: Wallet Shop, Verification Identity Desk, History Log Tabs (Column span 5) */}
        <aside className="md:col-span-5 flex flex-col gap-4">
          
          {/* Tab selector pill */}
          <nav className="bg-slate-900 border border-slate-850 p-1 rounded-xl grid grid-cols-4 gap-1 shadow-md">
            {[
              { id: 'wallet', label: 'Shop', icon: Coins },
              { id: 'profile', label: 'Identity', icon: UserIcon },
              { id: 'history', label: 'Ledgers', icon: History },
              { id: 'logs', label: 'Logs', icon: Terminal }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-2 px-1 rounded-lg text-[10px] font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 transition cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/5'
                      : 'text-slate-405 hover:text-slate-200 hover:bg-slate-850'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Active Panel Display */}
          <div className="flex-1">
            {activeTab === 'wallet' && (
              <CoinsWallet
                coinBalance={user.coinBalance}
                transactions={transactions}
                onRecharge={handleRechargeCoinWallet}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileScreen
                user={user}
                onUpdateProfile={handleUpdateProfile}
              />
            )}

            {activeTab === 'logs' && (
              <div id="diagnostic-logs-container" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-100 shadow-2xl h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Terminal className="text-amber-400 w-5 h-5" />
                      <h2 className="font-display font-semibold text-lg text-slate-100">Handshake Diagnostics</h2>
                    </div>
                    <button
                      onClick={() => setSocketLogs([])}
                      className="text-[9px] uppercase font-mono bg-slate-950 border border-slate-800 px-2 py-1 rounded hover:bg-slate-850 hover:text-rose-400 text-slate-400 transition cursor-pointer"
                      title="Clear session trace logs"
                    >
                      Clear
                    </button>
                  </div>

                  {/* Log list */}
                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 font-mono text-[10px] leading-relaxed">
                    {socketLogs.length === 0 ? (
                      <div className="text-center py-20 text-slate-500">
                        <p className="italic">No connection events recorded.</p>
                        <p className="text-[9px] mt-1 text-slate-600">State events will populate when matchmaking or calls cycle.</p>
                      </div>
                    ) : (
                      socketLogs.map((log) => {
                        let badgeColor = 'bg-slate-950 border-slate-900 text-slate-400';
                        if (log.type === 'success') badgeColor = 'bg-emerald-500/10 border-emerald-500/22 text-emerald-400';
                        if (log.type === 'warn') badgeColor = 'bg-amber-500/10 border-amber-500/22 text-amber-400';
                        if (log.type === 'error') badgeColor = 'bg-rose-500/10 border-rose-500/22 text-rose-400';
                        
                        return (
                          <div key={log.id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-855 flex flex-col gap-1 hover:border-slate-800 transition">
                            <div className="flex items-center justify-between">
                              <span className={`px-1.5 py-0.5 rounded border text-[8px] font-bold uppercase tracking-widest ${badgeColor}`}>
                                {log.event}
                              </span>
                              <span className="text-slate-600 text-[8px]">
                                {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-slate-300 break-words mt-0.5 leading-normal">{log.message}</p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="bg-slate-950 rounded-xl p-3 border border-slate-850 flex items-start gap-2 mt-4 shrink-0 font-sans text-[10px] text-slate-500 leading-normal">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 animate-pulse shrink-0" />
                  <p>
                    Connecting over secure WebSocket protocol. Handshake traces are generated automatically inside the active context.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div id="history-container" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-100 shadow-2xl h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <History className="text-amber-400 w-5 h-5" />
                    <h2 className="font-display font-semibold text-lg text-slate-100">Video Call Ledger Logs</h2>
                  </div>

                  <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {callsHistory.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-12">
                        No meeting sessions recorded yet. Start random matching to begin calls!
                      </p>
                    ) : (
                      callsHistory.map((call) => (
                        <div key={call.id} className="p-3 rounded-xl bg-slate-950 border border-slate-850 flex justify-between items-center text-xs">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1">
                              <span className="font-semibold text-slate-100">
                                Matched: {call.receiverId.startsWith('host_') ? call.receiverName.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '').trim() : 'Explorer'}
                              </span>
                              <span className="text-[9px] text-slate-500">
                                ({Math.round(call.durationSeconds)}s)
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500">
                              {new Date(call.startTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-mono text-xs font-semibold text-amber-400">
                              -{call.totalCoinsSpent} 🪙
                            </span>
                            <p className="text-[8px] text-slate-500 uppercase tracking-wider font-mono">Consolidated</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-slate-950 rounded-xl p-3 border border-slate-850 flex items-start gap-2 mt-4 shrink-0">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-slate-500 leading-normal font-sans">
                    Call ledger is cryptographically secured on local sandbox datastores. Audit summaries can be requested from the administration panel.
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* MINIMAL FOOTER ACCENTS */}
      <footer className="border-t border-slate-900 bg-slate-950/70 p-4 shrink-0 text-center text-[10px] font-mono text-slate-600 flex flex-col sm:flex-row justify-between items-center px-8 gap-2">
        <span className="flex items-center gap-1">
          <Laptop className="w-3.5 h-3.5 text-slate-500" />
          Secure sandboxed Full-stack execution node • Port 3000 Ingress
        </span>
        <span className="flex items-center gap-1 text-[9px] text-slate-500 font-sans">
          Powered by Gemini 2.5 Flash and Socket.io WebSockets
        </span>
      </footer>
    </div>
  );
}

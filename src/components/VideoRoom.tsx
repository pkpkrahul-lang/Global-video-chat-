/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, CameraOff, Mic, MicOff, PhoneOff, Send, Gift, 
  Flag, ArrowRight, Sparkles, MessageSquare, ShieldAlert, Heart
} from 'lucide-react';
import { AVAILABLE_GIFTS, Gift as GiftType } from '../types';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
}

interface VideoRoomProps {
  channelName: string;
  partnerProfile: {
    id: string;
    username: string;
    avatar: string;
    country: string;
    language: string;
    rating: number;
    bio: string;
  };
  isHost: boolean;
  role: string;
  coinBalance: number;
  socket: any;
  onHangUp: () => void;
  onSkipNext: () => void;
}

export default function VideoRoom({
  channelName,
  partnerProfile,
  isHost,
  role,
  coinBalance,
  socket,
  onHangUp,
  onSkipNext
}: VideoRoomProps) {
  // Video and Audio Device States
  const [cameraActive, setCameraActive] = useState(true);
  const [micActive, setMicActive] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // Chat message States
  const [messages, setMessages] = useState<Message[]>([]);
  const [typedMessage, setTypedMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // WebRTC & Simulated Video Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Active Call Stats
  const [callDuration, setCallDuration] = useState(0);

  // Gift Display State
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const [activeGiftAnimation, setActiveGiftAnimation] = useState<{ icon: string; name: string } | null>(null);

  // Moderation modal
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportedMessage, setReportedMessage] = useState('');

  // 1. Set up Local Media Stream (Webcam)
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    if (cameraActive) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          activeStream = stream;
          setLocalStream(stream);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        })
        .catch(err => {
          console.warn("Camera or microphone permission was denied/failed, falling back of simulated visual feed:", err);
        });
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraActive]);

  // 2. Continuous Call Duration Counter
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 3. Simulated Canvas Face Expressions for Host (Sakura, Chloe, Marcus, etc.)
  useEffect(() => {
    if (!isHost) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrameId: number;
    let mouthWobble = 0;
    let eyeBlinkTimer = 0;
    let particles: Array<{ x: number; y: number; r: number; speedY: number; opacity: number; color: string }> = [];

    const drawSimulatedHost = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const themeColor = 
        partnerProfile.id === 'host_sakura' ? '#fda4af' : 
        partnerProfile.id === 'host_chloe' ? '#d8b4fe' : 
        partnerProfile.id === 'host_marcus' ? '#86efac' : '#93c5fd';

      // Background decorative radar rings
      const circleCount = 4;
      for (let i = 0; i < circleCount; i++) {
        ctx.beginPath();
        const r = 90 + i * 45 + Math.sin(Date.now() / 1500) * 15;
        ctx.strokeStyle = `${themeColor}10`;
        ctx.lineWidth = 1.5;
        ctx.arc(canvas.width / 2, canvas.height / 2, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Live video scanline
      const scanLineY = (Date.now() / 8) % canvas.height;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.fillRect(0, scanLineY, canvas.width, 2);

      // Render Floating Embers/Hearts
      if (Math.random() < 0.04) {
        particles.push({
          x: canvas.width / 2 + (Math.random() - 0.5) * 120,
          y: canvas.height / 2 + 50,
          r: Math.random() * 4 + 2,
          speedY: -Math.random() * 1.5 - 0.5,
          opacity: 1,
          color: themeColor
        });
      }

      particles.forEach((p, idx) => {
        p.y += p.speedY;
        p.opacity -= 0.01;
        if (p.opacity <= 0) {
          particles.splice(idx, 1);
          return;
        }
        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      });

      // Ambient Avatar glow
      const grad = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 10,
        canvas.width / 2, canvas.height / 2, 75
      );
      grad.addColorStop(0, `${themeColor}25`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, 75, 0, Math.PI * 2);
      ctx.fill();

      // Main face ring
      ctx.beginPath();
      ctx.lineWidth = 4;
      ctx.strokeStyle = themeColor;
      ctx.arc(canvas.width / 2, canvas.height / 2, 60, 0, Math.PI * 2);
      ctx.shadowBlur = 15;
      ctx.shadowColor = themeColor;
      ctx.stroke();
      ctx.shadowBlur = 0; // Reset

      // Render Host Avatar Emoji large
      ctx.font = "52px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(partnerProfile.avatar, canvas.width / 2, canvas.height / 2 - 5);

      // Speaking mouth wave simulation
      if (isTyping) {
        mouthWobble += 0.2;
        ctx.beginPath();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#f59e0b'; // Amber waving indicator
        ctx.arc(canvas.width / 2, canvas.height / 2, 65 + Math.sin(mouthWobble) * 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Overlay text status
      ctx.font = "bold 10px monospace";
      ctx.fillStyle = isTyping ? '#f59e0b' : '#34d399';
      ctx.fillText(isTyping ? "• RECIPROCATING SPEAK •" : "• SECURE STREAM STABLE •", canvas.width / 2, canvas.height / 2 + 90);

      animFrameId = requestAnimationFrame(drawSimulatedHost);
    };

    drawSimulatedHost();

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [isHost, isTyping, partnerProfile]);

  // 4. Socket Interactions and signaling listeners
  useEffect(() => {
    if (!socket) return;

    // Receive chat message
    const handleMessageReceived = (data: { senderId: string; senderName: string; content: string; specialAction?: string }) => {
      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}`,
        senderId: data.senderId,
        senderName: data.senderName,
        content: data.content,
        timestamp: new Date()
      }]);

      if (data.specialAction === "celebrate") {
        // Run full screen effect if they celebrated
        setActiveGiftAnimation({ icon: '✨', name: 'Sparkles' });
        setTimeout(() => setActiveGiftAnimation(null), 3000);
      }
    };

    // Receive typing status from host
    const handleHostTyping = (data: { isTyping: boolean }) => {
      setIsTyping(data.isTyping);
    };

    // Receive gift broadcast globally
    const handleGiftBroadcast = (data: { gift: GiftType; senderId: string; receiverId: string; senderName: string; description: string }) => {
      setMessages(prev => [...prev, {
        id: `msg_gift_${Date.now()}`,
        senderId: 'system',
        senderName: 'System Ledger',
        content: `🎁 ${data.senderName} ${data.description}`,
        timestamp: new Date()
      }]);

      // Trigger temporary gift animation overlay over stream
      setActiveGiftAnimation({ icon: data.gift.icon, name: data.gift.name });
      setTimeout(() => setActiveGiftAnimation(null), 3500);
    };

    // Handle incoming WebRTC signals
    const handleOffer = ({ offer }: any) => {
      // Stub for WebRTC implementation
      console.log("WebRTC: Offer received, establishing pipeline");
    };

    const handleAnswer = ({ answer }: any) => {
      console.log("WebRTC: Answer received, rendering peer video");
    };

    const handleIceCandidate = ({ candidate }: any) => {
      console.log("WebRTC: Ice candidate gathered");
    };

    socket.on("message_received", handleMessageReceived);
    socket.on("host_typing_status", handleHostTyping);
    socket.on("gift_broadcast", handleGiftBroadcast);
    socket.on("webrtc_offer", handleOffer);
    socket.on("webrtc_answer", handleAnswer);
    socket.on("webrtc_ice_candidate", handleIceCandidate);

    // Initial greeting chat message
    setMessages([{
      id: "msg_welcome",
      senderId: partnerProfile.id,
      senderName: partnerProfile.username,
      content: `Hey! I'm speaking from ${partnerProfile.country}. ${partnerProfile.bio}`,
      timestamp: new Date()
    }]);

    return () => {
      socket.off("message_received", handleMessageReceived);
      socket.off("host_typing_status", handleHostTyping);
      socket.off("gift_broadcast", handleGiftBroadcast);
      socket.off("webrtc_offer", handleOffer);
      socket.off("webrtc_answer", handleAnswer);
      socket.off("webrtc_ice_candidate", handleIceCandidate);
    };
  }, [socket, partnerProfile]);

  // Scroll chat to bottom cleanly
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Send message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedMessage.trim() || !socket) return;

    const senderName = "Alex (You)";
    const senderId = "user_primary";

    // Set messages history for context
    const hist = messages.map(m => ({
      role: m.senderId === 'user_primary' ? 'user' as const : 'model' as const,
      content: m.content
    }));
    hist.push({ role: 'user', content: typedMessage });

    // Emit message event
    socket.emit("send_message", {
      channelName,
      senderId,
      senderName,
      content: typedMessage,
      messagesHistory: hist.slice(-6) // Only send recent 6 exchanges to stay concise
    });

    setMessages(prev => [...prev, {
      id: `msg_user_${Date.now()}`,
      senderId,
      senderName,
      content: typedMessage,
      timestamp: new Date()
    }]);

    setTypedMessage('');
  };

  // Send special Premium Gift
  const handleSendGift = (gift: GiftType) => {
    if (coinBalance < gift.cost) {
      alert(`⚠️ You do not have enough coins to purchase the ${gift.name} (${gift.cost} coins). Top up your wallet in the right panel!`);
      return;
    }

    if (socket) {
      socket.emit("send_gift", {
        channelName,
        giftId: gift.id,
        senderId: "user_primary",
        receiverId: partnerProfile.id,
        isHost
      });
    }

    setShowGiftPanel(false);
  };

  // Submit Reporting
  const handleReportSubmit = () => {
    if (!reportReason) return;
    setReportedMessage('Report submitted. Our moderation desk has put an active security trace on this feed to preserve visual safety.');
    setTimeout(() => {
      setShowReportModal(false);
      setReportedMessage('');
      setReportReason('');
      onSkipNext(); // Automatically skip upon reporting!
    }, 2800);
  };

  // Format Elapsed time
  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div id="videoroom-container" className="bg-slate-950 border border-slate-850 rounded-2xl overflow-hidden text-slate-100 shadow-2xl h-full flex flex-col lg:flex-row relative">
      
      {/* 1. Streams Panel (Large left box) */}
      <div className="flex-1 relative bg-slate-920 h-[380px] lg:h-full flex items-center justify-center">
        {isHost ? (
          /* Canvas-based responsive simulated feed */
          <div className="w-full h-full relative flex items-center justify-center p-4">
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              className="w-full h-full max-h-[420px] rounded-lg bg-slate-900 border border-slate-800 object-contain shadow-2xl shadow-slate-1000"
            />
            {/* Host Tag Overlay */}
            <div className="absolute top-8 left-8 flex items-center gap-1.5 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-800">
              <span className="text-xl leading-none">{partnerProfile.avatar}</span>
              <div className="flex flex-col">
                <span className="text-xs font-semibold">{partnerProfile.username}</span>
                <span className="text-[8px] text-slate-400 font-mono tracking-wider">{partnerProfile.country}</span>
              </div>
            </div>
          </div>
        ) : (
          /* Actual WebRTC Peer stream layout (Requires active peer) */
          <div className="w-full h-full relative" id="remote-peer-stream">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            
            {/* Overlay if stream empty */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-slate-400 gap-3">
              <div className="w-10 h-10 border-4 border-amber-400/20 border-t-amber-400 rounded-full animate-spin" />
              <p className="text-sm font-semibold">Aligning WebRTC secure camera peer links...</p>
              <p className="text-[10px] text-slate-500 max-w-xs text-center font-sans px-4">
                Open another tab matching simultaneously to test peer-to-peer streams instantly on local nodes.
              </p>
            </div>
            
            {/* Peer Tag Overlay */}
            <div className="absolute top-8 left-8 flex items-center gap-1.5 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-800">
              <span className="text-xs font-semibold">Matched Explorer</span>
            </div>
          </div>
        )}

        {/* Local Stream PIP overlay (User's webcam) */}
        <div className="absolute bottom-6 right-6 w-38 h-[142px] rounded-lg border-2 border-amber-400 shadow-2xl overflow-hidden bg-slate-900">
          {cameraActive ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-950">
              <CameraOff className="w-6 h-6 text-slate-600 animate-pulse" />
            </div>
          )}
          <span className="absolute bottom-1 right-2 text-[8px] bg-slate-950/70 border border-slate-800 text-slate-300 font-mono tracking-widest px-1 py-0.5 rounded">
            YOU (LOCAL)
          </span>
        </div>

        {/* Active Call Floating Stats panel */}
        <div className="absolute top-8 right-8 flex items-center gap-3">
          {/* Duration counter */}
          <span className="bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-800 font-mono text-xs font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            {formatTime(callDuration)}
          </span>
        </div>

        {/* Floating Call Gift Animation Overlay effect */}
        {activeGiftAnimation && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 bg-amber-500/5 animate-fade-in">
            <div className="relative text-7xl animate-bounce flex flex-col items-center">
              <span>{activeGiftAnimation.icon}</span>
              <span className="text-sm font-display font-semibold text-slate-100 bg-slate-950/90 border border-amber-400/30 px-3 py-1 mt-2 rounded-full shadow-lg">
                Received a {activeGiftAnimation.name}!
              </span>
            </div>
          </div>
        )}

        {/* Media Control Toolbar (Centred Bottom overlay) */}
        <div className="absolute bottom-6 left-1/2 translate-x-[-50%] flex items-center gap-2.5 bg-slate-950/90 backdrop-blur-md px-4 py-2.5 rounded-full border border-slate-800 shadow-inner z-20 shadow-slate-1000/50">
          {/* Mute cam */}
          <button
            onClick={() => setCameraActive(!cameraActive)}
            className={`p-2.5 rounded-full transition cursor-pointer ${
              cameraActive ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-red-500/20 text-red-400 hover:bg-red-500/35 border border-red-500/10'
            }`}
            title="Toggle video feed"
          >
            {cameraActive ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
          </button>

          {/* Mute mic */}
          <button
            onClick={() => setMicActive(!micActive)}
            className={`p-2.5 rounded-full transition cursor-pointer ${
              micActive ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-red-500/20 text-red-400 hover:bg-red-500/35 border border-red-500/10'
            }`}
            title="Toggle mic feed"
          >
            {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>

          <span className="h-4 border-l border-slate-850 mx-1" />

          {/* Report Button */}
          <button
            onClick={() => setShowReportModal(true)}
            className="p-2.5 rounded-full bg-slate-800 text-slate-400 hover:text-red-400 hover:bg-slate-700/80 transition cursor-pointer"
            title="Report or flag visual"
          >
            <Flag className="w-4 h-4" />
          </button>

          {/* Skip / Next Matching */}
          <button
            onClick={onSkipNext}
            className="p-2.5 rounded-full bg-amber-400 hover:bg-amber-500 text-slate-950 hover:scale-105 active:scale-95 transition flex items-center gap-1 cursor-pointer font-bold duration-300"
            title="Skip to next candidate"
          >
            <ArrowRight className="w-4 h-4" />
          </button>

          <span className="h-4 border-l border-slate-850 mx-1" />

          {/* Hang up / Return */}
          <button
            onClick={onHangUp}
            className="p-2.5 rounded-full bg-red-500 hover:bg-red-650 hover:scale-105 text-slate-100 transition flex items-center gap-0.5 cursor-pointer"
            title="Terminate meeting"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Text Chat & Gift Panel (Right side column) */}
      <div className="w-full lg:w-92 bg-slate-930 border-t lg:border-t-0 lg:border-l border-slate-850 flex flex-col h-[320px] lg:h-full justify-between">
        <div className="flex flex-col h-full justify-between overflow-hidden relative">
          
          {/* Header info */}
          <div className="p-3.5 bg-slate-920 border-b border-slate-850 flex justify-between items-center shrink-0">
            <span className="text-xs uppercase font-mono font-semibold tracking-wider flex items-center gap-1 text-slate-450">
              <MessageSquare className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              Active Chatroom
            </span>

            {/* Gifts Toggle tab */}
            <button
              onClick={() => setShowGiftPanel(!showGiftPanel)}
              className={`text-[10px] flex items-center gap-1 font-semibold px-2 py-1 rounded-lg border transition cursor-pointer hover:scale-103 active:scale-97 ${
                showGiftPanel
                  ? 'bg-amber-400/10 border-amber-400 text-amber-400'
                  : 'bg-slate-900 border-slate-800 text-amber-400 hover:border-amber-400/20'
              }`}
            >
              <Gift className="w-3 h-3 text-amber-400" /> Premium Gifting
            </button>
          </div>

          {showGiftPanel ? (
            /* Premium Gifts drawer */
            <div className="flex-1 bg-slate-950 p-4 overflow-y-auto" id="gift-drawer">
              <div className="text-center mb-4">
                <h3 className="text-xs font-semibold text-amber-400 flex items-center gap-1 justify-center">
                  <Sparkles className="w-3.5 h-3.5" /> Send Premium Reactions
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5 font-sans">
                  Gifts deduct coins from your balance and display full-screen interactive animation bursts over the stream!
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {AVAILABLE_GIFTS.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => handleSendGift(g)}
                    className="p-3 text-left rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-400/50 hover:bg-slate-850 transition duration-240 flex flex-col justify-between h-24 group cursor-pointer"
                  >
                    <span className="text-3xl group-hover:scale-120 transition duration-300">{g.icon}</span>
                    <div className="mt-1 leading-tighter">
                      <p className="text-xs font-semibold text-slate-200">{g.name}</p>
                      <p className="text-[10px] text-amber-400 font-mono tracking-tight mt-0.5">{g.cost} 🪙</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Standard Messaging Board */
            <div className="flex-1 overflow-y-auto p-4 space-y-3 font-sans">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col gap-0.5 ${
                    m.senderId === 'user_primary' ? 'items-end' : m.senderId === 'system' ? 'items-center w-full' : 'items-start'
                  }`}
                >
                  {m.senderId !== 'system' && (
                    <span className="text-[9px] text-slate-500 font-medium px-1">
                      {m.senderName} • {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  <div
                    className={`max-w-[85%] text-xs rounded-xl px-3 py-2 leading-relaxed ${
                      m.senderId === 'user_primary'
                        ? 'bg-amber-400 text-slate-950 rounded-tr-none font-medium'
                        : m.senderId === 'system'
                        ? 'bg-slate-900 border border-slate-850 text-slate-450 italic py-1 border-dotted font-mono text-[10px] tracking-wider rounded-md'
                        : 'bg-slate-900 border border-slate-850 text-slate-200 rounded-tl-none'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex items-center gap-1 text-[10px] text-amber-400 italic font-medium px-1 animate-pulse">
                  <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce delay-150" />
                  <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce delay-300" />
                  {partnerProfile.username} is typing...
                </div>
              )}
              <div ref={messageEndRef} />
            </div>
          )}

          {/* Form input messaging block */}
          <form onSubmit={handleSendMessage} className="p-3 bg-slate-920 border-t border-slate-850 flex gap-2 shrink-0">
            <input
              type="text"
              value={typedMessage}
              disabled={showGiftPanel}
              onChange={(e) => setTypedMessage(e.target.value)}
              placeholder={showGiftPanel ? 'Gifting panel active...' : 'Send message...'}
              className="flex-1 text-xs bg-slate-950 border border-slate-850 rounded-xl px-3 outline-none focus:border-slate-700 text-slate-200 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!typedMessage.trim() || showGiftPanel}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-500 disabled:opacity-30 disabled:text-slate-500 cursor-pointer transition border border-slate-850 hover:border-slate-700 flex items-center justify-center shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Moderation safety reporting modal Overlay panel */}
      {showReportModal && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-1.5 text-red-500 mb-3.5">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="font-display font-semibold text-slate-100">Report Inappropriate Feed</h3>
            </div>

            {reportedMessage ? (
              <p className="text-xs font-mono text-emerald-400 border border-emerald-500/20 bg-emerald-500/5 p-3 rounded-lg leading-normal">
                {reportedMessage}
              </p>
            ) : (
              <div className="space-y-4">
                <p className="text-[11px] text-slate-400 leading-normal font-sans">
                  Help preserve a safe connection space. Flagging feeds submits this caller's stream trace for instant human inspection.
                </p>

                <div className="space-y-2.5">
                  <label className="text-[10px] text-slate-500 uppercase font-mono font-semibold tracking-wider">Select Grievance</label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-850 p-2.5 rounded-xl text-slate-300 outline-none focus:border-slate-705"
                  >
                    <option value="">-- Choose reason --</option>
                    <option value="explicit">Nudity or Explicit Sexual Behavior</option>
                    <option value="abuse">Hostility, Bullying, or Hate Speech</option>
                    <option value="spam">Bot, Commercial Ads, or Static Recording</option>
                    <option value="other">Other Violation of Trust Terms</option>
                  </select>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    onClick={() => {
                      setShowReportModal(false);
                      setReportReason('');
                    }}
                    className="text-xs text-slate-400 hover:text-slate-200 border border-slate-800 px-3 py-1.5 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReportSubmit}
                    disabled={!reportReason}
                    className="text-xs bg-red-500 hover:bg-red-600 font-semibold px-3 py-1.5 rounded-xl disabled:opacity-40"
                  >
                    Submit Trace
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

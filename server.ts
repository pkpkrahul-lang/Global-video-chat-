/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { Server, Socket } from "socket.io";
import { GoogleGenAI } from "@google/genai";
import { AVAILABLE_GIFTS } from "./src/types";

// Database file path
const DB_FILE = path.join(process.cwd(), "db.json");

// Define basic interface for persistence
interface SavedState {
  user: {
    id: string;
    username: string;
    avatar: string;
    coinBalance: number;
    gender: 'male' | 'female' | 'unspecified';
    country: string;
    language: string;
    rating: number;
    unregistered?: boolean;
  };
  transactions: Array<{
    id: string;
    userId: string;
    amount: number;
    type: string;
    description: string;
    createdAt: string;
  }>;
  calls: Array<{
    id: string;
    callerId: string;
    receiverId: string;
    callerName: string;
    receiverName: string;
    startTime: string;
    endTime?: string;
    durationSeconds: number;
    totalCoinsSpent: number;
  }>;
}

// In-Memory Host Profile Presets
const HOST_PROFILES = [
  {
    id: "host_sakura",
    username: "Sakura 🇯🇵",
    avatar: "🌸",
    gender: "female",
    country: "Japan",
    language: "Japanese & English",
    rating: 4.9,
    bio: "Hi! Art student from Kyoto. I love watercolor, anime, and matching with people worldwide to exchange languages!",
    prompt: "You are Sakura, a Japanese art student from Kyoto. You are 21 years old. You are bubbly, very polite, use occasional emojis like 🌸 ✨, and speak Japanese-accented English. Keep answers sweet, short (1-2 sentences), and ask about their day."
  },
  {
    id: "host_marcus",
    username: "Marcus 🇧🇷",
    avatar: "⚽",
    gender: "male",
    country: "Brazil",
    language: "Portuguese, Spanish & English",
    rating: 4.8,
    bio: "Hey there! Gym bro, salsa dancer, and massive football fan in Rio de Janeiro. Let's chat and share positive vibes!",
    prompt: "You are Marcus, a 23-year-old fitness coach and dancer from Rio de Janeiro. You are highly energetic, friendly, say 'bro' or 'friend', and speak with massive passion. Keep answers extremely short (1-2 sentences), upbeat, and occasionally use emojis like ⚽ 🔥 🕺."
  },
  {
    id: "host_chloe",
    username: "Chloe 🇫🇷",
    avatar: "🥐",
    gender: "female",
    country: "France",
    language: "French & English",
    rating: 4.7,
    bio: "Bonjour! Paris-based fashion designer. Obsessed with black coffee, high heels, museum visits, and cute hats.",
    prompt: "You are Chloe, a 22-year-old fashion student from Paris. You are classy, sophisticated, slightly sarcastic but charming. You occasionally throw in French words like 'Bonjour' or 'Ooh la la'. Keep answers concise, witty, and intriguing."
  },
  {
    id: "host_elena",
    username: "Elena 🇮🇹",
    avatar: "🍝",
    gender: "female",
    country: "Italy",
    language: "Italian, English & French",
    rating: 4.95,
    bio: "Ciao! Cooking is my therapy. I am a pastry chef from Florence. Tell me your favorite food and let's discuss pasta!",
    prompt: "You are Elena, a 24-year-old pastry curator from Florence. You are incredibly warm, expressive, and food-loving. You start messages with 'Ciao!' and write about Italian food or cozy topics. Keep replies brief, inviting, and friendly."
  },
  {
    id: "host_mateo",
    username: "Mateo 🇲🇽",
    avatar: "🎸",
    gender: "male",
    country: "Mexico",
    language: "Spanish & English",
    rating: 4.85,
    bio: "Greetings! Acoustic guitarist and archaeologist. Love playing classic rock riffs under the stars. Jam with me!",
    prompt: "You are Mateo, a 23-year-old guitarist and history enthusiast from Mexico. You are very calm, artistic, philosophical, and use musical analogies. Keep replies short (1-2 clauses), very kind, and mention music ideas or starry nights."
  }
];

// Helper: Read state from DB
function readDb(): SavedState {
  if (fs.existsSync(DB_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
    } catch (e) {
      console.error("Error reading db file, regenerating:", e);
    }
  }

  // Initial State if empty
  const initialState: SavedState = {
    user: {
      id: "user_primary",
      username: "Alex",
      avatar: "🦊",
      coinBalance: 250, // Starts with some coins for quick testing of premium filters
      gender: "unspecified",
      country: "Global Area",
      language: "English",
      rating: 5.0
    },
    transactions: [
      {
        id: "tx_init",
        userId: "user_primary",
        amount: 250,
        type: "recharge",
        description: "Welcome bonus coins",
        createdAt: new Date().toISOString()
      }
    ],
    calls: []
  };

  fs.writeFileSync(DB_FILE, JSON.stringify(initialState, null, 2), "utf-8");
  return initialState;
}

// Helper: Save state to DB
function writeDb(state: SavedState) {
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf-8");
}

// Gemini Client Getter
let aiClient: GoogleGenAI | null = null;
function getGemini() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== "MY_GEMINI_API_KEY") {
      try {
        aiClient = new GoogleGenAI({ apiKey: key });
      } catch (e) {
        console.error("Failed to initialize GoogleGenAI:", e);
      }
    }
  }
  return aiClient;
}

// Generate Response using Gemini or Fallback
async function generateGeminiReply(hostId: string, messagesHistory: Array<{ role: 'user' | 'model', content: string }>) {
  const host = HOST_PROFILES.find(h => h.id === hostId);
  if (!host) return "Hello! Good to meet you.";

  const ai = getGemini();
  if (ai) {
    try {
      const chatContents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [
        {
          role: "user",
          parts: [{ text: host.prompt + " Respond to the conversation context without repeating yourself. No markdown italics, keep it just flat friendly natural chat text." }]
        }
      ];

      // Map histories
      messagesHistory.forEach(msg => {
        chatContents.push({
          role: msg.role === "user" ? "user" as const : "model" as const,
          parts: [{ text: msg.content }]
        });
      });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: chatContents,
        config: {
          maxOutputTokens: 100,
          temperature: 0.8
        }
      });

      if (response.text) {
        return response.text.trim();
      }
    } catch (e) {
      console.error("Gemini call failed, using generic mock response:", e);
    }
  }

  // Backup Mock responses if AI lacks key or hits rate limits
  const fallbackReplies = [
    `Oh wow, that is so beautiful! 🌸 Do you like art or travelling?`,
    `Haha that's amazing! Ciao! I was just organizing some thoughts. What are you doing right now?`,
    `Oh nice! Let's talk more, what is your favorite hobbies or favorite music? 🎸`,
    `Ah I totally agree! Paris is beautiful but meetings like this make the global world so small! 🥐`,
    `Very interesting! Send a little gift if you like my vibe, I can sing or show you something! ✨`
  ];
  return fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);

  // Initialize Socket.io
  const io = new Server(server, {
    cors: { origin: "*" }
  });

  app.use(express.json());

  // API Endpoints
  app.get("/api/state", (req, res) => {
    const data = readDb();
    res.json({
      user: data.user,
      transactions: data.transactions.slice().reverse(),
      calls: data.calls.slice().reverse(),
      hosts: HOST_PROFILES
    });
  });

  app.post("/api/recharge", (req, res) => {
    const { amount, description } = req.body;
    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "Invalid coin amount" });
    }

    const data = readDb();
    data.user.coinBalance += amount;
    
    const token = Math.random().toString(36).substring(2, 9).toUpperCase();
    const tx = {
      id: `tx_${Date.now()}_${token}`,
      userId: "user_primary",
      amount,
      type: "recharge" as const,
      description: description || "Coin Package Purchase",
      createdAt: new Date().toISOString()
    };

    data.transactions.push(tx);
    writeDb(data);

    // Broadcast balance update if active
    io.emit("system_balance_update", { balance: data.user.coinBalance });

    res.json({
      success: true,
      user: data.user,
      transaction: tx
    });
  });

  app.post("/api/update-profile", (req, res) => {
    const { username, avatar, gender, country, language } = req.body;
    const data = readDb();
    
    if (username) data.user.username = username;
    if (avatar) data.user.avatar = avatar;
    if (gender) data.user.gender = gender;
    if (country) data.user.country = country;
    if (language) data.user.language = language;
    
    writeDb(data);
    res.json({ success: true, user: data.user });
  });

  // Track active channels, matches, and billing intervals on server
  const matchmakingQueue: Array<{ socketId: string; userId: string; filters: any }> = [];
  
  // Call sessions map to holds billing timers or mock states
  // Key: channelName, Value: { intervalId, callerId, receiverId, type: 'peer' | 'host', billingAccumulated: number, startedAt: number }
  const activeBillingCalls: Record<string, {
    intervalId: NodeJS.Timeout;
    callerSocketId: string;
    partnerSocketId?: string;
    callerId: string;
    receiverId: string;
    type: 'peer' | 'host';
    coinsCharged: number;
    startedAt: number;
  }> = {};

  io.on("connection", (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Standard handshaking
    socket.emit("connected", { socketId: socket.id });

    // Handle when user enters matching pool
    socket.on("join_matchmaker", ({ userId, filters }) => {
      // 1. Verify user can afford 1 minute of chat (10 coins)
      const data = readDb();
      if (data.user.coinBalance < 10) {
        socket.emit("match_failed", { reason: "Insufficient balance! Please purchase more coins to unlock matches (minimum 10 coins needed)." });
        return;
      }

      // Check filters charge
      let filterCost = 0;
      if (filters.gender !== 'all') filterCost += 5;
      if (filters.region !== 'global') filterCost += 5;

      if (data.user.coinBalance < (10 + filterCost)) {
        socket.emit("match_failed", { reason: `Custom filters require ${filterCost} extra coins! Your remaining balance is too low.` });
        return;
      }

      // 2. Remove any stale queue requests for this socket
      const idx = matchmakingQueue.findIndex(q => q.socketId === socket.id);
      if (idx !== -1) matchmakingQueue.splice(idx, 1);

      // Add to queue
      matchmakingQueue.push({ socketId: socket.id, userId, filters });
      console.log(`User ${userId} entered queue. Queue length: ${matchmakingQueue.length}`);

      // Try matching immediately!
      tryMatchmaking();
    });

    socket.on("leave_matchmaker", () => {
      const idx = matchmakingQueue.findIndex(q => q.socketId === socket.id);
      if (idx !== -1) {
        matchmakingQueue.splice(idx, 1);
        console.log(`Socket ${socket.id} left queue.`);
      }
    });

    // Helper to find valid matches (real peer matching)
    function tryMatchmaking() {
      if (matchmakingQueue.length >= 2) {
        // Simple matchmaking for two real clients if both are in the queue and match filters
        // Let's pair index 0 and 1 for simplicity of WebRTC demo
        const clientA = matchmakingQueue.shift();
        const clientB = matchmakingQueue.shift();

        if (clientA && clientB) {
          const channelName = `room_peer_${clientA.userId}_${clientB.userId}_${Date.now()}`;
          
          // Notify both peers with a match found event
          io.to(clientA.socketId).emit("match_found", {
            channelName,
            partnerId: clientB.userId,
            isHost: false,
            partnerProfile: {
              id: clientB.userId,
              username: `Explorer ${clientB.userId.substring(0, 4)}`,
              avatar: "🧭",
              country: "Discovery Zone",
              language: "English",
              rating: 5.0,
              bio: "A fellow stranger looking to video chat!"
            },
            role: "initiator"
          });

          io.to(clientB.socketId).emit("match_found", {
            channelName,
            partnerId: clientA.userId,
            isHost: false,
            partnerProfile: {
              id: clientA.userId,
              username: `Explorer ${clientA.userId.substring(0, 4)}`,
              avatar: "🧭",
              country: "Discovery Zone",
              language: "English",
              rating: 5.0,
              bio: "A fellow stranger looking to video chat!"
            },
            role: "receiver"
          });

          console.log(`Matched Real Peers: ${clientA.userId} and ${clientB.userId} in channel ${channelName}`);
        }
      }
    }

    // Triggered if the client elects to match with a simulated Host directly,
    // OR if they timeout (after wait in client queue).
    socket.on("force_match_simulated_host", ({ userId, filters }) => {
      // Choose a host that fits gender filters
      let availableHosts = HOST_PROFILES;
      if (filters.gender !== 'all') {
        availableHosts = HOST_PROFILES.filter(h => h.gender === filters.gender);
      }
      if (availableHosts.length === 0) {
        availableHosts = HOST_PROFILES; // Fallback
      }

      const selectedHost = availableHosts[Math.floor(Math.random() * availableHosts.length)];
      const channelName = `room_host_${userId}_${selectedHost.id}_${Date.now()}`;

      // Remove from pool if they were there
      const idx = matchmakingQueue.findIndex(q => q.socketId === socket.id);
      if (idx !== -1) matchmakingQueue.splice(idx, 1);

      socket.emit("match_found", {
        channelName,
        partnerId: selectedHost.id,
        isHost: true,
        partnerProfile: selectedHost,
        role: "initiator"
      });

      console.log(`Matched User ${userId} with Mock Host ${selectedHost.id} in channel ${channelName}`);
    });

    // Start billing loop once call starts
    socket.on("start_call_billing", ({ channelName, callerId, receiverId, isHost, filters }) => {
      // If billing is already active on this channel, ignore
      if (activeBillingCalls[channelName]) return;

      console.log(`Starting billing for ${channelName}. Caller: ${callerId}. Target: ${receiverId}`);

      const data = readDb();
      // Deduct filter cost if filters are customized
      let initialCost = 10; // First minute base cost in coins
      let filterDetails = "Active video matching time";

      if (filters) {
        let extra = 0;
        if (filters.gender !== 'all') {
          extra += 5;
          filterDetails += " (Gender filter premium active)";
        }
        if (filters.region !== 'global') {
          extra += 5;
          filterDetails += " (Region filter premium active)";
        }
        initialCost += extra;
      }

      // 1. Check if user still has balance
      if (data.user.coinBalance < initialCost) {
        socket.emit("call_ended", { reason: "low_balance", description: "You ran out of coins. Please recharge to continue chatting." });
        return;
      }

      // 2. Perform initial deduction
      data.user.coinBalance -= initialCost;
      
      const txId = `tx_deduct_${Date.now()}`;
      data.transactions.push({
        id: txId,
        userId: callerId,
        amount: -initialCost,
        type: "deduction",
        description: filterDetails,
        createdAt: new Date().toISOString()
      });
      writeDb(data);

      socket.emit("balance_update", { balance: data.user.coinBalance });

      // Run continuous billing loop: e.g. deduct 1 coin every 6 seconds (equates to 10 coins/min)
      const intervalId = setInterval(() => {
        const currentData = readDb();
        const baseRate = 1; // 1 coin every 6 seconds

        if (currentData.user.coinBalance < baseRate) {
          console.log(`User ${callerId} hit empty balance during call. Disconnection triggered.`);
          
          socket.emit("call_ended", { reason: "low_balance", description: "Your coin balance has reached 0! Please top up." });
          
          const callInfo = activeBillingCalls[channelName];
          if (callInfo && callInfo.partnerSocketId) {
            io.to(callInfo.partnerSocketId).emit("call_ended", { reason: "partner_disconnected", description: "Partner ran out of coins" });
          }

          terminateCall(channelName);
        } else {
          currentData.user.coinBalance -= baseRate;
          
          // Accumulate inside call info
          const callInfo = activeBillingCalls[channelName];
          if (callInfo) {
            callInfo.coinsCharged += baseRate;
          }

          // We don't flood the transaction array with 1-coin items in db.json for stability.
          // Instead, we update the user balance directly, then when the call terminates, 
          // we insert a consolidated call history and single final transaction summary!
          writeDb(currentData);
          socket.emit("balance_update", { balance: currentData.user.coinBalance });
        }
      }, 6000); // 6 seconds = 1/10th of a minute

      // Track the active call details
      activeBillingCalls[channelName] = {
        intervalId,
        callerSocketId: socket.id,
        callerId,
        receiverId,
        type: isHost ? 'host' : 'peer',
        coinsCharged: initialCost,
        startedAt: Date.now()
      };
    });

    // Handle end-call or hangup signals
    socket.on("end_call", ({ channelName }) => {
      console.log(`Call termination initiated via end_call event: ${channelName}`);
      
      const call = activeBillingCalls[channelName];
      if (call) {
        // Inform partner of termination
        if (call.partnerSocketId && call.partnerSocketId !== socket.id) {
          io.to(call.partnerSocketId).emit("call_ended", { reason: "hung_up" });
        } else if (call.callerSocketId && call.callerSocketId !== socket.id) {
          io.to(call.callerSocketId).emit("call_ended", { reason: "hung_up" });
        }
        
        terminateCall(channelName);
        socket.emit("call_ended", { reason: "hung_up" });
      }
    });

    // Text messages during call
    socket.on("send_message", async ({ channelName, senderId, senderName, content, messagesHistory }) => {
      console.log(`Msg from ${senderId} in ${channelName}: ${content}`);

      // Broadcast message to everyone in the channel
      // But since it's peer-to-peer or mock host, let's look at the type of caller
      const call = activeBillingCalls[channelName];
      if (!call) return;

      // Emit user message to partner if peer-to-peer
      if (call.type === 'peer') {
        const target = call.callerSocketId === socket.id ? call.partnerSocketId : call.callerSocketId;
        if (target) {
          io.to(target).emit("message_received", { senderId, senderName, content });
        }
      } else {
        // It's a simulated mock host!
        // We simulate typing indicators and run Gemini SDK in the background, or fallback!
        socket.emit("host_typing_status", { isTyping: true });

        try {
          // Generate realistic conversation response using Gemini (with history and custom prompt)
          const replyText = await generateGeminiReply(call.receiverId, messagesHistory || [{ role: 'user', content }]);
          
          // Delay reply slightly so the typing looks authentic!
          setTimeout(() => {
            socket.emit("host_typing_status", { isTyping: false });
            socket.emit("message_received", {
              senderId: call.receiverId,
              senderName: HOST_PROFILES.find(h => h.id === call.receiverId)?.username || "Host",
              content: replyText
            });
          }, 1500);
        } catch (e) {
          console.error(e);
          socket.emit("host_typing_status", { isTyping: false });
        }
      }
    });

    // Gift sending event - premium coins transactions inside active call!
    socket.on("send_gift", ({ channelName, giftId, senderId, receiverId, isHost }) => {
      const gift = AVAILABLE_GIFTS.find(g => g.id === giftId);
      if (!gift) return;

      const data = readDb();
      if (data.user.coinBalance < gift.cost) {
        socket.emit("system_notification", { message: `❌ Insufficient coins! Sending ${gift.name} requires ${gift.cost} coins.`, type: "error" });
        return;
      }

      // Deduct coins
      data.user.coinBalance -= gift.cost;

      // Add to audit trail
      data.transactions.push({
        id: `tx_gift_${Date.now()}`,
        userId: senderId,
        amount: -gift.cost,
        type: "gift_send",
        description: `Sent virtual ${gift.name} gift (${gift.icon}) in video call`,
        createdAt: new Date().toISOString()
      });

      writeDb(data);

      // Broadcast gift animations to the room immediately!
      socket.emit("balance_update", { balance: data.user.coinBalance });
      socket.emit("gift_broadcast", {
        gift,
        senderId,
        receiverId,
        senderName: data.user.username,
        description: `sent a ${gift.name} ${gift.icon}!`
      });

      console.log(`User ${senderId} gifted ${gift.name} (${gift.cost} coins) to ${receiverId}`);

      // If it is a mock host, let the host react in chat or send back emojis!
      if (isHost) {
        socket.emit("host_typing_status", { isTyping: true });
        
        setTimeout(() => {
          socket.emit("host_typing_status", { isTyping: false });
          const reactions = {
            gift_rose: ["Omg a rose! Thank you so much! 🌹", "Haha sweet! You make me smile! 🥰"],
            gift_heart: ["Wow a whole heart! Sending a huge hug back! ❤️", "You are so lovely, thank you!"],
            gift_gem: ["A diamond! 💎 Omg you are too generous! Thank you!", "Wow, look at all the sparkle! 💎 I am amazed!"],
            gift_star: ["✨ A magical star! Making a wish together!", "Thank you for brightening my screen! ✨"],
            gift_rocket: ["🚀 TO THE MOON! That rocket is incredible! Thank you so much, amazing explorer!", "Omg a rocket launch! 🚀 You are literally the best!"]
          };
          const hostList = reactions[giftId as keyof typeof reactions] || ["Thank you so much! 🥰"];
          const selectedText = hostList[Math.floor(Math.random() * hostList.length)];

          socket.emit("message_received", {
            senderId: receiverId,
            senderName: HOST_PROFILES.find(h => h.id === receiverId)?.username || "Host",
            content: selectedText,
            specialAction: "celebrate"
          });
        }, 1200);
      }
    });

    // WebRTC Signaling events passed directly to peers!
    socket.on("webrtc_offer", ({ channelName, offer }) => {
      const call = activeBillingCalls[channelName];
      if (call) {
        const target = call.callerSocketId === socket.id ? call.partnerSocketId : call.callerSocketId;
        if (target) {
          io.to(target).emit("webrtc_offer", { offer });
        }
      }
    });

    socket.on("webrtc_answer", ({ channelName, answer }) => {
      const call = activeBillingCalls[channelName];
      if (call) {
        const target = call.callerSocketId === socket.id ? call.partnerSocketId : call.callerSocketId;
        if (target) {
          io.to(target).emit("webrtc_answer", { answer });
        }
      }
    });

    socket.on("webrtc_ice_candidate", ({ channelName, candidate }) => {
      const call = activeBillingCalls[channelName];
      if (call) {
        const target = call.callerSocketId === socket.id ? call.partnerSocketId : call.callerSocketId;
        if (target) {
          io.to(target).emit("webrtc_ice_candidate", { candidate });
        }
      }
    });

    // Cleanup active call state upon force termination
    function terminateCall(channelName: string) {
      const call = activeBillingCalls[channelName];
      if (!call) return;

      clearInterval(call.intervalId);

      // Consolidate logs and details in db
      const data = readDb();
      const durationSeconds = Math.round((Date.now() - call.startedAt) / 1000);

      const callerName = data.user.id === call.callerId ? data.user.username : `User ${call.callerId.substring(0, 4)}`;
      const hostPreset = HOST_PROFILES.find(h => h.id === call.receiverId);
      const receiverName = call.type === 'host' ? (hostPreset?.username || "Host profile") : `User ${call.receiverId.substring(0,4)}`;

      // Save call log
      data.calls.push({
        id: `call_${Date.now()}`,
        callerId: call.callerId,
        receiverId: call.receiverId,
        callerName,
        receiverName,
        startTime: new Date(call.startedAt).toISOString(),
        endTime: new Date().toISOString(),
        durationSeconds,
        totalCoinsSpent: call.coinsCharged
      });

      writeDb(data);
      delete activeBillingCalls[channelName];
      console.log(`Call terminated cleanly: ${channelName}. Duration: ${durationSeconds} seconds.`);
    }

    // Clean up connections on socket disconnect
    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
      
      // Remove from matchmaking queue
      const idx = matchmakingQueue.findIndex(q => q.socketId === socket.id);
      if (idx !== -1) matchmakingQueue.splice(idx, 1);

      // Terminate any calls they were involved in
      for (const channelName in activeBillingCalls) {
        const call = activeBillingCalls[channelName];
        if (call.callerSocketId === socket.id || call.partnerSocketId === socket.id) {
          const partnerSocket = call.callerSocketId === socket.id ? call.partnerSocketId : call.callerSocketId;
          if (partnerSocket) {
            io.to(partnerSocket).emit("call_ended", { reason: "partner_disconnected", description: "Your chat partner disconnected!" });
          }
          terminateCall(channelName);
          break;
        }
      }
    });
  });

  // Apply Vite Dev Server dynamic files injection middleware in sandboxes
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    // Production serving compiled index static structures
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Full-stack server online on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Express initialization error:", err);
});

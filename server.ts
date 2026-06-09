/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import http from "http";
import path from "path";
import { Server, Socket } from "socket.io";
import { readDb, writeDb, SavedState } from "./src/db";
import { HOST_PROFILES } from "./src/hostProfiles";
import { generateGeminiReply } from "./src/aiService";
import { AVAILABLE_GIFTS } from "./src/types";
import { BILLING } from "./src/constants";

// Minimal socket event typing
interface ClientToServerEvents {
  join_matchmaker: (data: { userId: string; filters: any }) => void;
  leave_matchmaker: () => void;
  force_match_simulated_host: (data: { userId: string; filters: any }) => void;
  start_call_billing: (data: { channelName: string; callerId: string; receiverId: string; isHost: boolean; filters?: any }) => void;
  end_call: (data: { channelName: string }) => void;
  send_message: (data: { channelName: string; senderId: string; senderName: string; content: string; messagesHistory?: Array<{ role: 'user' | 'model'; content: string }> }) => void;
  send_gift: (data: { channelName: string; giftId: string; senderId: string; receiverId: string; isHost: boolean }) => void;
  webrtc_offer: (data: { channelName: string; offer: any }) => void;
  webrtc_answer: (data: { channelName: string; answer: any }) => void;
  webrtc_ice_candidate: (data: { channelName: string; candidate: any }) => void;
}

interface ServerToClientEvents {
  connected: (data: { socketId: string }) => void;
  match_failed: (data: any) => void;
  match_found: (data: any) => void;
  system_balance_update: (data: any) => void;
  balance_update: (data: any) => void;
  call_ended: (data: any) => void;
  message_received: (data: any) => void;
  host_typing_status: (data: any) => void;
  gift_broadcast: (data: any) => void;
  system_notification: (data: any) => void;
  webrtc_offer: (data: any) => void;
  webrtc_answer: (data: any) => void;
  webrtc_ice_candidate: (data: any) => void;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
  const server = http.createServer(app);

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: { origin: "*" }
  });

  app.use(express.json());

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
    const { amount, description } = req.body as { amount: number; description?: string };
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

  const matchmakingQueue: Array<{ socketId: string; userId: string; filters: any }> = [];

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

  io.on("connection", (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    console.log(`Socket connected: ${socket.id}`);
    socket.emit("connected", { socketId: socket.id });

    socket.on("join_matchmaker", ({ userId, filters }) => {
      try {
        const data = readDb();
        if (data.user.coinBalance < 10) {
          socket.emit("match_failed", { reason: "Insufficient balance! Please purchase more coins to unlock matches (minimum 10 coins needed)." });
          return;
        }

        let filterCost = 0;
        if (filters?.gender !== 'all') filterCost += BILLING.GENDER_FILTER_COST;
        if (filters?.region !== 'global') filterCost += BILLING.REGION_FILTER_COST;

        if (data.user.coinBalance < (10 + filterCost)) {
          socket.emit("match_failed", { reason: `Custom filters require ${filterCost} extra coins! Your remaining balance is too low.` });
          return;
        }

        const idx = matchmakingQueue.findIndex(q => q.socketId === socket.id);
        if (idx !== -1) matchmakingQueue.splice(idx, 1);

        matchmakingQueue.push({ socketId: socket.id, userId, filters });
        console.log(`User ${userId} entered queue. Queue length: ${matchmakingQueue.length}`);

        tryMatchmaking();
      } catch (err) {
        console.error("join_matchmaker error:", err);
      }
    });

    socket.on("leave_matchmaker", () => {
      const idx = matchmakingQueue.findIndex(q => q.socketId === socket.id);
      if (idx !== -1) {
        matchmakingQueue.splice(idx, 1);
        console.log(`Socket ${socket.id} left queue.`);
      }
    });

    function tryMatchmaking() {
      if (matchmakingQueue.length >= 2) {
        const clientA = matchmakingQueue.shift();
        const clientB = matchmakingQueue.shift();

        if (clientA && clientB) {
          const channelName = `room_peer_${clientA.userId}_${clientB.userId}_${Date.now()}`;

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

    socket.on("force_match_simulated_host", ({ userId, filters }) => {
      try {
        let availableHosts = HOST_PROFILES;
        if (filters?.gender !== 'all') {
          availableHosts = HOST_PROFILES.filter(h => h.gender === filters.gender);
        }
        if (availableHosts.length === 0) availableHosts = HOST_PROFILES;

        const selectedHost = availableHosts[Math.floor(Math.random() * availableHosts.length)];
        const channelName = `room_host_${userId}_${selectedHost.id}_${Date.now()}`;

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
      } catch (err) {
        console.error("force_match_simulated_host error:", err);
      }
    });

    socket.on("start_call_billing", ({ channelName, callerId, receiverId, isHost, filters }) => {
      try {
        if (activeBillingCalls[channelName]) return;

        console.log(`Starting billing for ${channelName}. Caller: ${callerId}. Target: ${receiverId}`);

        const data = readDb();
        let initialCost = BILLING.BASE_CALL_COST;
        let filterDetails = "Active video matching time";

        if (filters) {
          let extra = 0;
          if (filters.gender !== 'all') {
            extra += BILLING.GENDER_FILTER_COST;
            filterDetails += " (Gender filter premium active)";
          }
          if (filters.region !== 'global') {
            extra += BILLING.REGION_FILTER_COST;
            filterDetails += " (Region filter premium active)";
          }
          initialCost += extra;
        }

        if (data.user.coinBalance < initialCost) {
          socket.emit("call_ended", { reason: "low_balance", description: "You ran out of coins. Please recharge to continue chatting." });
          return;
        }

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

        const intervalId = setInterval(() => {
          try {
            const currentData = readDb();
            const baseRate = BILLING.COINS_PER_INTERVAL;

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

              const callInfo = activeBillingCalls[channelName];
              if (callInfo) callInfo.coinsCharged += baseRate;

              writeDb(currentData);
              socket.emit("balance_update", { balance: currentData.user.coinBalance });
            }
          } catch (err) {
            console.error("billing interval error:", err);
          }
        }, BILLING.BILLING_INTERVAL_MS);

        activeBillingCalls[channelName] = {
          intervalId,
          callerSocketId: socket.id,
          callerId,
          receiverId,
          type: isHost ? 'host' : 'peer',
          coinsCharged: initialCost,
          startedAt: Date.now()
        };
      } catch (err) {
        console.error("start_call_billing error:", err);
      }
    });

    socket.on("end_call", ({ channelName }) => {
      try {
        console.log(`Call termination initiated via end_call event: ${channelName}`);
        const call = activeBillingCalls[channelName];
        if (call) {
          if (call.partnerSocketId && call.partnerSocketId !== socket.id) {
            io.to(call.partnerSocketId).emit("call_ended", { reason: "hung_up" });
          } else if (call.callerSocketId && call.callerSocketId !== socket.id) {
            io.to(call.callerSocketId).emit("call_ended", { reason: "hung_up" });
          }

          terminateCall(channelName);
          socket.emit("call_ended", { reason: "hung_up" });
        }
      } catch (err) {
        console.error("end_call error:", err);
      }
    });

    socket.on("send_message", async ({ channelName, senderId, senderName, content, messagesHistory }) => {
      try {
        console.log(`Msg from ${senderId} in ${channelName}: ${content}`);
        const call = activeBillingCalls[channelName];
        if (!call) return;

        if (call.type === 'peer') {
          const target = call.callerSocketId === socket.id ? call.partnerSocketId : call.callerSocketId;
          if (target) io.to(target).emit("message_received", { senderId, senderName, content });
        } else {
          socket.emit("host_typing_status", { isTyping: true });
          try {
            const replyText = await generateGeminiReply(call.receiverId, messagesHistory || [{ role: 'user', content }]);
            setTimeout(() => {
              socket.emit("host_typing_status", { isTyping: false });
              socket.emit("message_received", {
                senderId: call.receiverId,
                senderName: HOST_PROFILES.find(h => h.id === call.receiverId)?.username || "Host",
                content: replyText
              });
            }, BILLING.TYPING_DELAY_MS);
          } catch (e) {
            console.error(e);
            socket.emit("host_typing_status", { isTyping: false });
          }
        }
      } catch (err) {
        console.error("send_message error:", err);
      }
    });

    socket.on("send_gift", ({ channelName, giftId, senderId, receiverId, isHost }) => {
      try {
        const gift = AVAILABLE_GIFTS.find(g => g.id === giftId);
        if (!gift) return;

        const data = readDb();
        if (data.user.coinBalance < gift.cost) {
          socket.emit("system_notification", { message: `❌ Insufficient coins! Sending ${gift.name} requires ${gift.cost} coins.`, type: "error" });
          return;
        }

        data.user.coinBalance -= gift.cost;

        data.transactions.push({
          id: `tx_gift_${Date.now()}`,
          userId: senderId,
          amount: -gift.cost,
          type: "gift_send",
          description: `Sent virtual ${gift.name} gift (${gift.icon}) in video call`,
          createdAt: new Date().toISOString()
        });

        writeDb(data);

        socket.emit("balance_update", { balance: data.user.coinBalance });
        socket.emit("gift_broadcast", {
          gift,
          senderId,
          receiverId,
          senderName: data.user.username,
          description: `sent a ${gift.name} ${gift.icon}!`
        });

        console.log(`User ${senderId} gifted ${gift.name} (${gift.cost} coins) to ${receiverId}`);

        if (isHost) {
          socket.emit("host_typing_status", { isTyping: true });

          setTimeout(() => {
            socket.emit("host_typing_status", { isTyping: false });
            const reactions: Record<string, string[]> = {
              gift_rose: ["Omg a rose! Thank you so much! 🌹", "Haha sweet! You make me smile! 🥰"],
              gift_heart: ["Wow a whole heart! Sending a huge hug back! ❤️", "You are so lovely, thank you!"],
              gift_gem: ["A diamond! 💎 Omg you are too generous! Thank you!", "Wow, look at all the sparkle! 💎 I am amazed!"],
              gift_star: ["✨ A magical star! Making a wish together!", "Thank you for brightening my screen! ✨"],
              gift_rocket: ["🚀 TO THE MOON! That rocket is incredible! Thank you so much, amazing explorer!", "Omg a rocket launch! 🚀 You are literally the best!"]
            };
            const hostList = reactions[giftId] || ["Thank you so much! 🥰"];
            const selectedText = hostList[Math.floor(Math.random() * hostList.length)];

            socket.emit("message_received", {
              senderId: receiverId,
              senderName: HOST_PROFILES.find(h => h.id === receiverId)?.username || "Host",
              content: selectedText,
              specialAction: "celebrate"
            });
          }, BILLING.HOST_REACTION_DELAY_MS);
        }
      } catch (err) {
        console.error("send_gift error:", err);
      }
    });

    socket.on("webrtc_offer", ({ channelName, offer }) => {
      const call = activeBillingCalls[channelName];
      if (call) {
        const target = call.callerSocketId === socket.id ? call.partnerSocketId : call.callerSocketId;
        if (target) io.to(target).emit("webrtc_offer", { offer });
      }
    });

    socket.on("webrtc_answer", ({ channelName, answer }) => {
      const call = activeBillingCalls[channelName];
      if (call) {
        const target = call.callerSocketId === socket.id ? call.partnerSocketId : call.callerSocketId;
        if (target) io.to(target).emit("webrtc_answer", { answer });
      }
    });

    socket.on("webrtc_ice_candidate", ({ channelName, candidate }) => {
      const call = activeBillingCalls[channelName];
      if (call) {
        const target = call.callerSocketId === socket.id ? call.partnerSocketId : call.callerSocketId;
        if (target) io.to(target).emit("webrtc_ice_candidate", { candidate });
      }
    });

    function terminateCall(channelName: string) {
      const call = activeBillingCalls[channelName];
      if (!call) return;

      clearInterval(call.intervalId);

      try {
        const data = readDb();
        const durationSeconds = Math.round((Date.now() - call.startedAt) / 1000);

        const callerName = data.user.id === call.callerId ? data.user.username : `User ${call.callerId.substring(0, 4)}`;
        const hostPreset = HOST_PROFILES.find(h => h.id === call.receiverId);
        const receiverName = call.type === 'host' ? (hostPreset?.username || "Host profile") : `User ${call.receiverId.substring(0,4)}`;

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
      } catch (err) {
        console.error("terminateCall save error:", err);
      }

      delete activeBillingCalls[channelName];
      console.log(`Call terminated cleanly: ${channelName}.`);
    }

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
      const idx = matchmakingQueue.findIndex(q => q.socketId === socket.id);
      if (idx !== -1) matchmakingQueue.splice(idx, 1);

      for (const channelName in activeBillingCalls) {
        const call = activeBillingCalls[channelName];
        if (call.callerSocketId === socket.id || call.partnerSocketId === socket.id) {
          const partnerSocket = call.callerSocketId === socket.id ? call.partnerSocketId : call.callerSocketId;
          if (partnerSocket) io.to(partnerSocket).emit("call_ended", { reason: "partner_disconnected", description: "Your chat partner disconnected!" });
          terminateCall(channelName);
          break;
        }
      }
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
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

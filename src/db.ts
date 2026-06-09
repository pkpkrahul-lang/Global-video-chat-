import fs from "fs";
import path from "path";
import { User, CoinTransaction, CallSession } from "./types";

export type SavedState = {
  user: User;
  transactions: CoinTransaction[];
  calls: CallSession[];
};

export const DB_FILE = path.join(process.cwd(), "db.json");

export function readDb(): SavedState {
  if (fs.existsSync(DB_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
    } catch (e) {
      console.error("Error reading db file, regenerating:", e);
    }
  }

  const initialState: SavedState = {
    user: {
      id: "user_primary",
      username: "Alex",
      avatar: "🦊",
      coinBalance: 250,
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

export function writeDb(state: SavedState) {
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf-8");
}

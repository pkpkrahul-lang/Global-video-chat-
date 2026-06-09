import { GoogleGenAI } from "@google/genai";
import { HOST_PROFILES } from "./hostProfiles";

let aiClient: GoogleGenAI | null = null;

export function getGemini() {
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

export async function generateGeminiReply(hostId: string, messagesHistory: Array<{ role: 'user' | 'model', content: string }>) {
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

      if ((response as any).text) {
        return ((response as any).text as string).trim();
      }
    } catch (e) {
      console.error("Gemini call failed, using generic mock response:", e);
    }
  }

  const fallbackReplies = [
    `Oh wow, that is so beautiful! 🌸 Do you like art or travelling?`,
    `Haha that's amazing! Ciao! I was just organizing some thoughts. What are you doing right now?`,
    `Oh nice! Let's talk more, what is your favorite hobbies or favorite music? 🎸`,
    `Ah I totally agree! Paris is beautiful but meetings like this make the global world so small! 🥐`,
    `Very interesting! Send a little gift if you like my vibe, I can sing or show you something! ✨`
  ];
  return fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
}

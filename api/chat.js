export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Clé GEMINI_API_KEY manquante dans Vercel" });
  }

  try {
    const { messages, system, max_tokens } = req.body;

    const contents = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content.map(b => b.text || "").join("")
          : String(msg.content) }]
    }));

    const geminiBody = {
      ...(system ? { system_instruction: { parts: [{ text: system }] } } : {}),
      contents,
      tools: [{ google_search: {} }],
      generationConfig: {
        maxOutputTokens: max_tokens || 3000,
        temperature: 0.7,
      },
    };

    // Gemini 1.5 Flash — 1500 req/jour gratuites
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiBody),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || JSON.stringify(data.error) || "Erreur Gemini"
      });
    }

    const text = data.candidates?.[0]?.content?.parts
      ?.filter(p => p.text)
      ?.map(p => p.text)
      ?.join("\n") || "Je n'ai pas pu analyser ça.";

    return res.status(200).json({
      content: [{ type: "text", text }]
    });

  } catch (error) {
    return res.status(500).json({ error: error.message || "Erreur serveur" });
  }
}

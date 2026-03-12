export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Clé GEMINI_API_KEY manquante dans Vercel" });
  }

  try {
    // Convertit le format Anthropic → format Gemini
    const { messages, system, max_tokens } = req.body;

    // Construit le contenu Gemini : system prompt + historique
    const contents = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: typeof msg.content === "string" ? msg.content : msg.content.map(b => b.text || "").join("") }]
    }));

    const geminiBody = {
      system_instruction: system ? { parts: [{ text: system }] } : undefined,
      contents,
      tools: [{ google_search: {} }],
      generationConfig: {
        maxOutputTokens: max_tokens || 3000,
        temperature: 0.7,
      },
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiBody),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || "Erreur Gemini" });
    }

    // Extrait le texte de la réponse Gemini
    const text = data.candidates?.[0]?.content?.parts
      ?.filter(p => p.text)
      ?.map(p => p.text)
      ?.join("\n") || "Je n'ai pas pu analyser ça.";

    // Retourne dans le format attendu par le front (compatible Anthropic)
    return res.status(200).json({
      content: [{ type: "text", text }]
    });

  } catch (error) {
    return res.status(500).json({ error: error.message || "Erreur serveur" });
  }
}

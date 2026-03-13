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

    // Noms exacts selon la doc officielle Gemini API 2025
    const MODELS = [
      "gemini-1.5-flash-8b",
      "gemini-1.5-flash-8b-001",
      "gemini-1.5-flash-002",
      "gemini-1.5-flash-001",
      "gemini-1.0-pro",
      "gemini-1.0-pro-001",
    ];

    let lastError = null;
    const tried = [];

    for (const model of MODELS) {
      tried.push(model);
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiBody),
        }
      );

      const data = await response.json();
      lastError = data.error?.message || "";

      if (!response.ok) {
        if (lastError.includes("not found") || lastError.includes("not supported") || response.status === 404) {
          continue;
        }
        return res.status(response.status).json({ error: lastError });
      }

      const text = data.candidates?.[0]?.content?.parts
        ?.filter(p => p.text)
        ?.map(p => p.text)
        ?.join("\n") || "Je n'ai pas pu analyser ça.";

      return res.status(200).json({ content: [{ type: "text", text }], model_used: model });
    }

    // Si aucun modèle ne marche, on liste ceux disponibles pour déboguer
    const listRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const listData = await listRes.json();
    const available = listData.models
      ?.filter(m => m.supportedGenerationMethods?.includes("generateContent"))
      ?.map(m => m.name)
      ?.join(", ") || "impossible de lister";

    return res.status(500).json({
      error: `Modèles essayés : ${tried.join(", ")}. Modèles disponibles sur ta clé : ${available}`
    });

  } catch (error) {
    return res.status(500).json({ error: error.message || "Erreur serveur" });
  }
}

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

    // On essaie plusieurs noms de modèles jusqu'à trouver celui qui marche
    const MODELS = [
      "gemini-2.0-flash-lite",
      "gemini-2.0-flash",
      "gemini-1.5-flash-001",
      "gemini-1.5-flash",
      "gemini-pro",
    ];

    let lastError = null;

    for (const model of MODELS) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiBody),
        }
      );

      const data = await response.json();

      // Si le modèle n'existe pas, on essaie le suivant
      if (!response.ok) {
        lastError = data.error?.message || `Erreur ${response.status}`;
        if (lastError.includes("not found") || lastError.includes("not supported") || response.status === 404) {
          continue;
        }
        // Autre erreur (quota, auth...) → on arrête
        return res.status(response.status).json({ error: lastError });
      }

      const text = data.candidates?.[0]?.content?.parts
        ?.filter(p => p.text)
        ?.map(p => p.text)
        ?.join("\n") || "Je n'ai pas pu analyser ça.";

      return res.status(200).json({
        content: [{ type: "text", text }],
        model_used: model,
      });
    }

    return res.status(500).json({ error: `Aucun modèle disponible. Dernière erreur : ${lastError}` });

  } catch (error) {
    return res.status(500).json({ error: error.message || "Erreur serveur" });
  }
}

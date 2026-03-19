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

    const today = new Date().toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });

    // On injecte la date du jour dans le system prompt pour forcer la recherche actuelle
    const systemWithDate = (system || "") + `\n\nAujourd'hui nous sommes le ${today}. Tu DOIS utiliser Google Search pour trouver des informations RÉCENTES et ACTUELLES. Ne te base JAMAIS sur ta mémoire d'entraînement pour des faits sportifs — les résultats, classements, blessés et formes changent chaque semaine. CHERCHE TOUJOURS avant de répondre.`;

    const contents = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content.map(b => b.text || "").join("")
          : String(msg.content) }]
    }));

    const geminiBody = {
      system_instruction: { parts: [{ text: systemWithDate }] },
      contents,
      // google_search en mode "dynamic retrieval" force vraiment la recherche
      tools: [{
        google_search: {}
      }],
      // tool_config force l'utilisation de l'outil (AUTO = Gemini décide, mais on le pousse via le prompt)
      tool_config: {
        function_calling_config: { mode: "AUTO" }
      },
      generationConfig: {
        maxOutputTokens: max_tokens || 4000,
        temperature: 0.4, // Plus bas = plus factuel, moins d'invention
      },
    };

    const MODELS = [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-flash-latest",
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
      lastError = data.error?.message || "";

      if (!response.ok) {
        if (lastError.includes("not found") || lastError.includes("not supported") || response.status === 404) continue;
        return res.status(response.status).json({ error: lastError });
      }

      // Extraire tout le texte, y compris après les appels de recherche
      const parts = data.candidates?.[0]?.content?.parts || [];
      const text = parts.filter(p => p.text).map(p => p.text).join("\n")
        || "Je n'ai pas pu analyser ça.";

      // Vérifier si une recherche a vraiment été faite
      const searchUsed = parts.some(p => p.functionCall || p.functionResponse) ||
        data.candidates?.[0]?.groundingMetadata?.webSearchQueries?.length > 0;

      return res.status(200).json({
        content: [{ type: "text", text }],
        model_used: model,
        search_used: searchUsed,
      });
    }

    return res.status(500).json({ error: `Erreur : ${lastError}` });

  } catch (error) {
    return res.status(500).json({ error: error.message || "Erreur serveur" });
  }
}

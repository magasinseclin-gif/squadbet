export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const serperKey = process.env.SERPER_API_KEY;
  if (!geminiKey) return res.status(500).json({ error: "Clé GEMINI_API_KEY manquante" });

  try {
    const { messages, system, max_tokens } = req.body;
    const today = new Date().toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });

    // ── Détecte si c'est une demande d'analyse sportive ──────────────────────
    const lastUserMsg = messages.filter(m => m.role === "user").pop();
    const userText = typeof lastUserMsg?.content === "string"
      ? lastUserMsg.content
      : lastUserMsg?.content?.map(b => b.text || "").join("") || "";

    const isMatchAnalysis = /vs|contre|match|analyse|pronostic|pari|cote|forme|blessé|résultat|classement/i.test(userText);

    let webContext = "";

    // ── Recherche Serper.dev ──────────────────────────────────────────────────
    if (isMatchAnalysis && serperKey) {
      try {
        const queries = [
          userText.slice(0, 120),
          `blessés suspendus forme ${userText.slice(0, 80)}`,
        ];

        const searchResults = await Promise.all(queries.map(q =>
          fetch("https://google.serper.dev/search", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-API-KEY": serperKey,
            },
            body: JSON.stringify({ q, num: 5, hl: "fr", gl: "fr" }),
          }).then(r => r.json()).catch(() => null)
        ));

        const snippets = searchResults.flatMap(r => [
          ...(r?.organic?.map(item => `• ${item.title} : ${item.snippet}`) || []),
          ...(r?.topStories?.map(item => `• [Actualité] ${item.title}`) || []),
        ]).slice(0, 10).join("\n");

        if (snippets) {
          webContext = `\n\n=== RÉSULTATS DE RECHERCHE WEB EN TEMPS RÉEL (${today}) ===\n${snippets}\n=== FIN ===`;
        }
      } catch(e) {
        console.error("Serper error:", e.message);
      }
    }

    // ── Construit le system prompt avec les données web injectées ────────────
    const systemFinal = (system || "") +
      `\n\nAujourd'hui : ${today}.` +
      (webContext
        ? `\n\nVoici des données FRAÎCHES récupérées depuis Google à l'instant. BASE-TOI EXCLUSIVEMENT sur ces données pour ton analyse — ignore ta mémoire d'entraînement pour tout fait sportif récent :\n${webContext}`
        : `\n\nUtilise google_search pour chercher des infos actuelles. Ta mémoire est obsolète pour les données sportives.`);

    const contents = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{
        text: typeof msg.content === "string"
          ? msg.content
          : Array.isArray(msg.content)
            ? msg.content.map(b => b.text || "").join("")
            : String(msg.content)
      }]
    }));

    const geminiBody = {
      system_instruction: { parts: [{ text: systemFinal }] },
      contents,
      tools: [{ google_search: {} }],
      generationConfig: {
        maxOutputTokens: max_tokens || 4000,
        temperature: 0.3,
      },
    };

    const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
    let lastError = null;

    for (const model of MODELS) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(geminiBody) }
      );

      const data = await response.json();
      lastError = data.error?.message || "";

      if (!response.ok) {
        if (lastError.includes("not found") || lastError.includes("not supported") || response.status === 404) continue;
        return res.status(response.status).json({ error: lastError });
      }

      const parts = data.candidates?.[0]?.content?.parts || [];
      const text = parts.filter(p => p.text).map(p => p.text).join("\n")
        || "Je n'ai pas pu analyser ça.";

      return res.status(200).json({
        content: [{ type: "text", text }],
        model_used: model,
        search_used: !!webContext,
      });
    }

    return res.status(500).json({ error: lastError });

  } catch (error) {
    return res.status(500).json({ error: error.message || "Erreur serveur" });
  }
}

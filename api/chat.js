export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Les fonctions Vercel utilisent les variables sans préfixe REACT_APP_
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.REACT_APP_ANTHROPIC_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Clé API manquante dans les variables Vercel" });
  }

  try {
    const body = {
      ...req.body,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "web-search-2025-03-05",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Erreur serveur" });
  }
}

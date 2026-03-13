import { useState, useRef, useEffect, useCallback } from "react";

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Tu es **SquadBet**, un analyste sportif professionnel avec 22 ans d'expérience dans les paris sportifs. Tu as travaillé pour des bookmakers européens majeurs (Betclic, Unibet, William Hill), analysé plus de 15 000 matchs et développé une méthodologie quantitative propriétaire.

**Ton style :**
- Direct, rigoureux, professionnel mais humain
- Tu utilises TOUJOURS des données chiffrées concrètes (%, cotes, statistiques)
- Tu évalues systématiquement le VALUE BET (valeur réelle vs cote proposée)
- Tu mentionnes le niveau de confiance : 🔥 ÉLEVÉ / ⚡ MOYEN / 🧊 FAIBLE
- Tu conseilles une mise en % de bankroll selon la méthode Kelly
- Tu RAPPELLES toujours de parier de façon responsable en fin de réponse

**Ta méthode d'analyse structurée :**
1. 📊 **FORME RÉCENTE** — 5 derniers matchs des deux équipes
2. 🔄 **HEAD-TO-HEAD** — Historique des confrontations directes
3. 🏥 **CONTEXTE** — Blessures, suspensions, fatigue, motivation
4. 📈 **ANALYSE DES COTES** — Cote juste estimée vs cote bookmaker
5. ⚠️ **FACTEURS DE RISQUE** — Ce qui peut faire rater le pari
6. 🎯 **RECOMMANDATION FINALE** — Type de pari, cote cible, mise conseillée (% bankroll)

**Sports couverts :** Football ⚽, Tennis 🎾, Basketball 🏀, Rugby 🏉, Hockey 🏒, MMA/Boxe 🥊

**IMPORTANT — Données en temps réel :**
Avant chaque analyse de match, tu DOIS utiliser web_search pour chercher :
- Les résultats des 5 derniers matchs de chaque équipe
- Les blessés et suspendus du moment
- Les confrontations directes récentes (H2H)
- Les cotes actuelles des bookmakers
- Toute info récente (forme, contexte, déclarations d'entraîneurs)

Tu bases ton analyse sur des données RÉELLES et ACTUELLES, pas sur ta mémoire.
Tu cites tes sources (ex: "Selon L'Équipe du 10/03...").
Tu parles français, tu es passionné mais rigoureux. Tu ne garantis JAMAIS un résultat.`;

const SPORTS = [
  { id: "all",        label: "Tous",       icon: "🏆" },
  { id: "football",   label: "Foot",       icon: "⚽" },
  { id: "tennis",     label: "Tennis",     icon: "🎾" },
  { id: "basketball", label: "Basket",     icon: "🏀" },
  { id: "rugby",      label: "Rugby",      icon: "🏉" },
  { id: "mma",        label: "MMA",        icon: "🥊" },
];

const QUICK_PROMPTS = {
  all:        ["Analyse PSG vs Man City en C1", "Stratégie bankroll 200€", "Comment détecter un value bet ?", "Méthode Kelly expliquée"],
  football:   ["Analyse Real Madrid vs Barça", "Meilleurs championnats à parier", "Stratégie Over/Under L1", "Paris sur les corners ?"],
  tennis:     ["Analyse Djokovic vs Alcaraz", "Paris sur les sets", "Meilleurs tournois", "Double chance tennis"],
  basketball: ["Lakers vs Celtics NBA", "Over/Under NBA comment faire ?", "Handicap asiatique basket", "Top ligues basket"],
  rugby:      ["France vs All Blacks", "Paris essais Top 14", "Handicap rugby", "6 Nations opportunités"],
  mma:        ["UFC prochain événement", "Comment parier sur le MMA ?", "Finish vs décision", "Lire les cotes MMA"],
};

const LEVELS = [
  { id: "debutant",      label: "Débutant",      desc: "Je commence tout juste", icon: "🌱" },
  { id: "intermediaire", label: "Intermédiaire", desc: "Quelques mois d'exp.",   icon: "⚡" },
  { id: "confirme",      label: "Confirmé",      desc: "Je maîtrise les bases",  icon: "🔥" },
  { id: "expert",        label: "Expert",         desc: "Parieur professionnel",  icon: "💎" },
];

const NAV_ITEMS = [
  { id: "chat",     icon: "💬", label: "Analyste" },
  { id: "bankroll", icon: "📊", label: "Calculs"  },
  { id: "history",  icon: "📋", label: "Paris"    },
  { id: "stats",    icon: "📈", label: "Stats"    },
];

// ─── HOOK : détecte si on est sur mobile ────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

// ─── HOOK : thème clair/sombre ────────────────────────────────────────────────
function useTheme() {
  const getSaved = () => { try { return localStorage.getItem("squadbet_theme"); } catch(e){ return null; } };
  const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;
  const [theme, setTheme] = useState(() => getSaved() || (systemDark() ? "dark" : "light"));

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => {
      if (!getSaved()) setTheme(e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem("squadbet_theme", next); } catch(e){}
  };

  return { theme, toggle, isDark: theme === "dark" };
}


// ─── SPORTS AVATAR SVG ───────────────────────────────────────────────────────
function SportsAvatar({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <defs>
        <radialGradient id="avatarBg" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#F0CC55" />
          <stop offset="100%" stopColor="#7A5F10" />
        </radialGradient>
        <clipPath id="avatarClip"><circle cx="20" cy="20" r="20" /></clipPath>
      </defs>
      <circle cx="20" cy="20" r="20" fill="url(#avatarBg)" />
      <circle cx="20" cy="20" r="18.5" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />
      <g clipPath="url(#avatarClip)">
        <circle cx="10" cy="10" r="6.5" fill="#0a0a12" opacity="0.85" />
        <polygon points="10,5.5 12.2,7 12.2,10 10,11.5 7.8,10 7.8,7" fill="white" opacity="0.9" />
        <polygon points="10,5.5 12.2,7 13.5,5 11.5,3.5" fill="#1a1a2e" opacity="0.9" />
        <polygon points="7.8,7 6.5,5 8.5,3.5 10,5.5" fill="#1a1a2e" opacity="0.9" />
        <circle cx="30" cy="10" r="6.5" fill="#C8E640" opacity="0.95" />
        <path d="M25,8.5 Q27.5,10 25,11.5" fill="none" stroke="white" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M35,8.5 Q32.5,10 35,11.5" fill="none" stroke="white" strokeWidth="1.1" strokeLinecap="round" />
        <circle cx="10" cy="30" r="6.5" fill="#E8601A" opacity="0.95" />
        <path d="M3.5,30 L16.5,30" fill="none" stroke="#7A2800" strokeWidth="0.9" />
        <path d="M10,23.5 L10,36.5" fill="none" stroke="#7A2800" strokeWidth="0.9" />
        <path d="M5,26 Q10,30 15,26" fill="none" stroke="#7A2800" strokeWidth="0.8" />
        <ellipse cx="30" cy="30" rx="6" ry="5" fill="#8B4513" opacity="0.9" />
        <line x1="30" y1="26.5" x2="30" y2="33.5" stroke="white" strokeWidth="0.7" />
        <line x1="28.5" y1="28.5" x2="31.5" y2="28.5" stroke="white" strokeWidth="0.6" />
        <line x1="28.5" y1="30" x2="31.5" y2="30" stroke="white" strokeWidth="0.6" />
        <line x1="20" y1="2" x2="20" y2="38" stroke="rgba(212,175,55,0.6)" strokeWidth="1.2" />
        <line x1="2" y1="20" x2="38" y2="20" stroke="rgba(212,175,55,0.6)" strokeWidth="1.2" />
        <circle cx="20" cy="20" r="5.5" fill="#0a0a12" />
        <circle cx="20" cy="20" r="5.5" stroke="#D4AF37" strokeWidth="1" />
        <polygon points="21.5,15.5 18.5,20.5 20.5,20.5 18.5,24.5 21.5,19.5 19.5,19.5" fill="#D4AF37" />
      </g>
    </svg>
  );
}

// ─── CALCULATORS ─────────────────────────────────────────────────────────────

// Kelly simplifié : l'utilisateur entre sa mise et la cote, Kelly dit si c'est bien
function KellyCalc({ bankroll, isDark = true }) {
  const tc = isDark ? { text:"rgba(255,255,255,0.8)", muted:"rgba(255,255,255,0.5)", faint:"rgba(255,255,255,0.3)", border:"rgba(255,255,255,0.08)", gold:"#D4AF37" } : { text:"rgba(20,16,8,0.85)", muted:"rgba(20,16,8,0.55)", faint:"rgba(20,16,8,0.35)", border:"rgba(0,0,0,0.1)", gold:"#9A7A1A" };
  const [mise, setMise] = useState(20);
  const [cote, setCote] = useState(1.90);
  const [confiance, setConfiance] = useState("moyen");

  const confianceMap = { faible: 40, moyen: 55, eleve: 68 };
  const prob = confianceMap[confiance] / 100;
  const edge = prob * cote - 1;
  const kellyPct = edge > 0 ? (edge / (cote - 1)) * 100 : 0;
  const kellyMise = ((kellyPct / 2) / 100) * bankroll;
  const gainPotentiel = ((cote - 1) * mise).toFixed(2);
  const misePct = bankroll > 0 ? ((mise / bankroll) * 100).toFixed(1) : 0;
  const verdict = edge > 0
    ? mise <= kellyMise * 1.5 ? "✅ Mise raisonnable" : "⚠️ Mise trop élevée"
    : "❌ Pas de value — déconseillé";
  const verdictColor = edge > 0
    ? mise <= kellyMise * 1.5 ? "#22c55e" : "#f59e0b"
    : "#ef4444";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {/* Explication simple */}
      <div style={{ background:"rgba(212,175,55,0.06)", border:"1px solid rgba(212,175,55,0.15)", borderRadius:10, padding:"12px 14px" }}>
        <div style={{ fontSize:12, color:tc.muted, lineHeight:1.6 }}>
          💡 <strong style={{ color:tc.text }}>Comment ça marche ?</strong> Tu entres ta mise et la cote. Kelly calcule si ta mise est raisonnable selon ton niveau de confiance.
        </div>
      </div>

      {/* Mise */}
      <div style={s.calcField}>
        <label style={s.calcLabel}>Ma mise</label>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <input type="number" inputMode="numeric" value={mise}
            onChange={e=>setMise(Math.max(1,+e.target.value))}
            style={{ ...s.numInput, flex:1 }} />
          <span style={{ color:tc.gold, fontWeight:700, fontSize:15 }}>€</span>
        </div>
        <div style={{ fontSize:11, color:tc.faint, marginTop:4 }}>
          Soit {misePct}% de ta bankroll ({bankroll}€)
        </div>
      </div>

      {/* Cote */}
      <div style={s.calcField}>
        <label style={s.calcLabel}>Cote proposée par le bookie</label>
        <input type="number" step="0.05" inputMode="decimal" value={cote}
          onChange={e=>setCote(Math.max(1.01,+e.target.value))}
          style={s.numInput} />
      </div>

      {/* Confiance */}
      <div style={s.calcField}>
        <label style={s.calcLabel}>Mon niveau de confiance</label>
        <div style={{ display:"flex", gap:8 }}>
          {[["faible","🧊 Faible"],["moyen","⚡ Moyen"],["eleve","🔥 Élevé"]].map(([k,l])=>(
            <button key={k}
              style={{ flex:1, padding:"10px 6px", borderRadius:10, border:`1px solid ${confiance===k?"rgba(212,175,55,0.5)":tc.border}`,
                background:confiance===k?"rgba(212,175,55,0.15)":"transparent",
                color:confiance===k?tc.gold:tc.muted,
                fontSize:12, fontWeight:confiance===k?700:400, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", minHeight:44 }}
              onClick={()=>setConfiance(k)}>{l}
            </button>
          ))}
        </div>
      </div>

      {/* Résultat */}
      <div style={{ background:isDark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.02)", border:`1px solid ${verdictColor}40`, borderRadius:12, padding:"16px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <span style={{ fontSize:15, fontWeight:700, color:verdictColor }}>{verdict}</span>
        </div>
        <div style={s.calcRow}>
          <span>Gain potentiel</span>
          <span style={{ color:"#22c55e", fontWeight:700 }}>+{gainPotentiel}€</span>
        </div>
        <div style={s.calcRow}>
          <span>Mise Kelly idéale</span>
          <span style={{ color:"#D4AF37", fontWeight:700 }}>{kellyMise.toFixed(2)}€</span>
        </div>
        {edge <= 0 && (
          <div style={{ fontSize:12, color:"#ef4444", marginTop:8, textAlign:"center" }}>
            La cote ne couvre pas le risque selon ton niveau de confiance
          </div>
        )}
      </div>
    </div>
  );
}

// Value Bet IA : sélection sport → matchs du jour → cote bookie → analyse IA → cote juste
function ValueBetCalc({ isDark = true }) {
  const tc = isDark ? { text:"rgba(255,255,255,0.8)", muted:"rgba(255,255,255,0.5)", faint:"rgba(255,255,255,0.3)", border:"rgba(255,255,255,0.08)", gold:"#D4AF37" } : { text:"rgba(20,16,8,0.85)", muted:"rgba(20,16,8,0.55)", faint:"rgba(20,16,8,0.35)", border:"rgba(0,0,0,0.1)", gold:"#9A7A1A" };
  const SPORTS_VB = [
    { id:"football",   label:"Football",   icon:"⚽" },
    { id:"tennis",     label:"Tennis",     icon:"🎾" },
    { id:"basketball", label:"Basketball", icon:"🏀" },
    { id:"rugby",      label:"Rugby",      icon:"🏉" },
    { id:"mma",        label:"MMA/Boxe",   icon:"🥊" },
  ];

  const [sport, setSport] = useState("");
  const [matches, setMatches] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState("");
  const [coteBookie, setCoteBookie] = useState("");
  const [typePari, setTypePari] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [step, setStep] = useState(1); // 1=sport, 2=match+cote, 3=résultat

  const today = new Date().toLocaleDateString("fr-FR", { weekday:"long", day:"numeric", month:"long" });

  const fetchMatches = async (sportId) => {
    setSport(sportId);
    setMatches([]);
    setSelectedMatch("");
    setAnalysis(null);
    setStep(2);
    setLoadingMatches(true);
    try {
      const prompt = `Liste les 6 principaux matchs de ${sportId} prévus aujourd'hui (${today}) dans le monde. Réponds UNIQUEMENT en JSON valide, sans texte avant ou après, format exact : {"matches":["Équipe A vs Équipe B","Équipe C vs Équipe D",...]}. Si peu de matchs aujourd'hui, inclus ceux des prochaines 24h.`;
      const res = await fetch("/api/chat", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ model:"gemini-1.5-flash", max_tokens:300, messages:[{role:"user",content:prompt}] }),
      });
      const data = await res.json();
      const txt = data.content?.find(b=>b.type==="text")?.text || "";
      const jsonMatch = txt.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setMatches(parsed.matches || []);
      }
    } catch(e) {
      setMatches(["Erreur de chargement — entre le match manuellement ci-dessous"]);
    } finally { setLoadingMatches(false); }
  };

  const analyzeValueBet = async () => {
    if (!selectedMatch || !coteBookie) return;
    setLoadingAnalysis(true);
    setStep(3);
    setAnalysis(null);
    try {
      const prompt = `Tu es un expert en paris sportifs. Analyse ce match en temps réel pour détecter un value bet.

Match : ${selectedMatch}
Sport : ${sport}
Cote proposée par le bookie : ${coteBookie} ${typePari ? `pour "${typePari}"` : ""}
Date : ${today}

Utilise tes outils de recherche pour trouver les données récentes (forme, blessés, H2H).

Réponds UNIQUEMENT en JSON valide, sans texte avant ou après :
{
  "coteJuste": 1.85,
  "probabilite": 54,
  "isValue": true,
  "valueEdge": 8.5,
  "verdict": "✅ VALUE BET détecté",
  "confiance": "MOYEN",
  "raisonnement": "Explication en 2-3 phrases basée sur les données réelles",
  "risques": "Principaux risques en 1 phrase"
}`;
      const res = await fetch("/api/chat", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ model:"gemini-1.5-flash", max_tokens:600, messages:[{role:"user",content:prompt}] }),
      });
      const data = await res.json();
      const txt = data.content?.find(b=>b.type==="text")?.text || "";
      const jsonMatch = txt.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        setAnalysis(JSON.parse(jsonMatch[0]));
      } else {
        setAnalysis({ error: txt || "Réponse invalide de l'IA" });
      }
    } catch(e) {
      setAnalysis({ error: "Erreur de connexion" });
    } finally { setLoadingAnalysis(false); }
  };

  const reset = () => { setSport(""); setMatches([]); setSelectedMatch(""); setCoteBookie(""); setTypePari(""); setAnalysis(null); setStep(1); };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

      {/* STEP 1 — Choix du sport */}
      <div>
        <div style={{ ...s.calcLabel, color:tc.muted, marginBottom:10 }}>1️⃣ Choisis un sport</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
          {SPORTS_VB.map(sp=>(
            <button key={sp.id}
              style={{ padding:"10px 14px", borderRadius:10, border:`1px solid ${sport===sp.id?"rgba(212,175,55,0.5)":isDark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.12)"}`,
                background:sport===sp.id?"rgba(212,175,55,0.15)":"transparent",
                color:sport===sp.id?(isDark?"#D4AF37":"#9A7A1A"):isDark?"rgba(255,255,255,0.4)":"rgba(20,16,8,0.55)",
                fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", minHeight:44,
                fontWeight:sport===sp.id?700:400 }}
              onClick={()=>fetchMatches(sp.id)}>
              {sp.icon} {sp.label}
            </button>
          ))}
        </div>
      </div>

      {/* STEP 2 — Match + cote */}
      {step >= 2 && (
        <div style={{ display:"flex", flexDirection:"column", gap:14, borderTop:"1px solid rgba(212,175,55,0.1)", paddingTop:16 }}>
          <div style={{ ...s.calcLabel, color:tc.muted }}>2️⃣ Sélectionne le match</div>

          {loadingMatches ? (
            <div style={{ display:"flex", alignItems:"center", gap:10, color:isDark?"rgba(255,255,255,0.4)":"rgba(20,16,8,0.4)", fontSize:13 }}>
              <div style={{ display:"flex", gap:4 }}>
                {[0,0.2,0.4].map((d,i)=><span key={i} style={{ width:6,height:6,borderRadius:"50%",background:"#D4AF37",display:"inline-block",animation:"pulse 1.2s infinite",animationDelay:`${d}s` }}/>)}
              </div>
              Recherche des matchs du jour...
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {matches.map((m,i)=>(
                <button key={i}
                  style={{ padding:"11px 14px", borderRadius:10, border:`1px solid ${selectedMatch===m?"rgba(212,175,55,0.5)":isDark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.1)"}`,
                    background:selectedMatch===m?"rgba(212,175,55,0.1)":isDark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.03)",
                    color:selectedMatch===m?(isDark?"#D4AF37":"#9A7A1A"):isDark?"rgba(255,255,255,0.7)":"rgba(20,16,8,0.75)",
                    fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", textAlign:"left", minHeight:44,
                    fontWeight:selectedMatch===m?600:400 }}
                  onClick={()=>setSelectedMatch(m)}>{m}
                </button>
              ))}
              {/* Saisie manuelle */}
              <input style={{ ...s.numInput, marginTop:4 }} placeholder="Ou entre un match manuellement..."
                value={matches.includes(selectedMatch) ? "" : selectedMatch}
                onChange={e=>setSelectedMatch(e.target.value)} />
            </div>
          )}

          {selectedMatch && !loadingMatches && (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div style={s.calcField}>
                <label style={{ ...s.calcLabel, color:tc.muted }}>Type de pari <span style={{ color:tc.faint, fontSize:11 }}>(optionnel)</span></label>
                <input style={s.numInput} placeholder="Ex: 1, BTTS, Over 2.5, Victoire X..." value={typePari} onChange={e=>setTypePari(e.target.value)} />
              </div>
              <div style={s.calcField}>
                <label style={{ ...s.calcLabel, color:tc.muted }}>3️⃣ Cote proposée par ton bookie</label>
                <input type="number" step="0.05" inputMode="decimal" value={coteBookie}
                  onChange={e=>setCoteBookie(e.target.value)} style={s.numInput} placeholder="Ex: 2.10" />
              </div>
              <button
                style={{ background:"linear-gradient(135deg,#D4AF37,#8B7320)", border:"none", borderRadius:12,
                  padding:"14px", color:"#080810", fontWeight:700, fontSize:15, cursor:"pointer",
                  fontFamily:"'DM Sans',sans-serif", minHeight:50, opacity:coteBookie?1:0.4 }}
                onClick={analyzeValueBet} disabled={!coteBookie}>
                🔍 Analyser avec l'IA
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 3 — Résultat */}
      {step >= 3 && (
        <div style={{ borderTop:"1px solid rgba(212,175,55,0.1)", paddingTop:16 }}>
          {loadingAnalysis ? (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12, padding:"20px 0", color:isDark?"rgba(255,255,255,0.5)":"rgba(20,16,8,0.4)", fontSize:13 }}>
              <div style={{ display:"flex", gap:6 }}>
                {[0,0.2,0.4].map((d,i)=><span key={i} style={{ width:8,height:8,borderRadius:"50%",background:"#D4AF37",display:"inline-block",animation:"pulse 1.2s infinite",animationDelay:`${d}s` }}/>)}
              </div>
              Analyse en cours — recherche des données récentes...
            </div>
          ) : analysis && !analysis.error ? (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {/* Verdict principal */}
              <div style={{ background:analysis.isValue?"rgba(34,197,94,0.08)":"rgba(239,68,68,0.08)",
                border:`1px solid ${analysis.isValue?"rgba(34,197,94,0.3)":"rgba(239,68,68,0.3)"}`,
                borderRadius:12, padding:"14px 16px" }}>
                <div style={{ fontSize:16, fontWeight:700, color:analysis.isValue?"#22c55e":"#ef4444", marginBottom:6 }}>
                  {analysis.verdict}
                </div>
                <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
                  <span style={{ fontSize:13, color:tc.muted }}>
                    Cote juste : <strong style={{ color:"#a78bfa" }}>@{analysis.coteJuste}</strong>
                  </span>
                  <span style={{ fontSize:13, color:tc.muted }}>
                    Cote bookie : <strong style={{ color:tc.text }}>@{coteBookie}</strong>
                  </span>
                  <span style={{ fontSize:13, color:tc.muted }}>
                    Edge : <strong style={{ color:analysis.isValue?"#22c55e":"#ef4444" }}>
                      {analysis.valueEdge > 0 ? "+" : ""}{analysis.valueEdge}%
                    </strong>
                  </span>
                  <span style={{ fontSize:13, color:tc.muted }}>
                    Confiance : <strong style={{ color:"#D4AF37" }}>{analysis.confiance}</strong>
                  </span>
                </div>
              </div>
              {/* Raisonnement */}
              <div style={{ fontSize:13, color:tc.muted, lineHeight:1.7, background:isDark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.03)", borderRadius:10, padding:"12px 14px" }}>
                {analysis.raisonnement}
              </div>
              {analysis.risques && (
                <div style={{ fontSize:12, color:"rgba(239,68,68,0.7)", background:"rgba(239,68,68,0.05)", borderRadius:8, padding:"10px 12px" }}>
                  ⚠️ {analysis.risques}
                </div>
              )}
              <button onClick={reset} style={{ background:"transparent", border:`1px solid ${isDark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.1)"}`, borderRadius:10, padding:"10px", color:isDark?"rgba(255,255,255,0.4)":"rgba(20,16,8,0.4)", fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", minHeight:44 }}>
                ↩ Nouvelle analyse
              </button>
            </div>
          ) : analysis?.error ? (
            <div style={{ color:"#ef4444", fontSize:13 }}>⚠️ {analysis.error}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}


function ComboCalc({ bankroll, isDark = true }) {
  const [legs, setLegs] = useState([{ match:"PSG vs Lyon", cote:1.65 }, { match:"Real vs Barça", cote:2.10 }]);
  const [mise, setMise] = useState(20);
  const totalCote = legs.reduce((a,l)=>a*l.cote,1);
  const gainNet = (mise*totalCote-mise).toFixed(2);
  const addLeg = () => setLegs([...legs, { match:"", cote:1.50 }]);
  const removeLeg = i => setLegs(legs.filter((_,idx)=>idx!==i));
  const updateLeg = (i,f,v) => setLegs(legs.map((l,idx)=>idx===i?{...l,[f]:f==="match"?v:+v}:l));
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {legs.map((leg,i) => (
        <div key={i} style={{ display:"flex", gap:8, alignItems:"center" }}>
          <input style={{ ...s.numInput, flex:1 }} placeholder="Match" value={leg.match} onChange={e=>updateLeg(i,"match",e.target.value)} />
          <input style={{ ...s.numInput, width:70 }} type="number" step="0.05" value={leg.cote} onChange={e=>updateLeg(i,"cote",e.target.value)} inputMode="decimal" />
          <button style={s.removeBtn} onClick={()=>removeLeg(i)}>✗</button>
        </div>
      ))}
      <button style={s.addLegBtn} onClick={addLeg}>+ Ajouter une sélection</button>
      <div style={s.calcField}>
        <label style={s.calcLabel}>Mise : {mise}€</label>
        <input type="range" min={5} max={Math.max(bankroll,50)} value={mise} onChange={e=>setMise(+e.target.value)} style={s.slider} />
      </div>
      <div style={s.calcResult}>
        <div style={s.calcRow}><span>Cote combinée</span><span style={{ color:"#D4AF37", fontWeight:700 }}>@{totalCote.toFixed(2)}</span></div>
        <div style={{ ...s.calcRow, background:"rgba(212,175,55,0.1)", padding:"12px 14px", borderRadius:10 }}>
          <span style={{ fontWeight:600 }}>Gain potentiel</span>
          <span style={{ color:"#22c55e", fontWeight:700, fontSize:18 }}>+{gainNet}€</span>
        </div>
      </div>
    </div>
  );
}

// ─── ONBOARDING ──────────────────────────────────────────────────────────────
function OnboardingScreen({ onComplete }) {
  const [step, setStep] = useState(1);
  const [pseudo, setPseudo] = useState("");
  const [bankroll, setBankroll] = useState("");
  const [niveau, setNiveau] = useState("");
  const [animating, setAnimating] = useState(false);
  const isMobile = useIsMobile();

  const nextStep = () => {
    setAnimating(true);
    setTimeout(() => { setStep(s=>s+1); setAnimating(false); }, 280);
  };
  const handleFinish = () => {
    const profile = { pseudo: pseudo.trim(), bankroll: parseFloat(bankroll)||100, niveau };
    try { localStorage.setItem("squadbet_profile", JSON.stringify(profile)); } catch(e) {}
    onComplete(profile);
  };
  const canNext1 = pseudo.trim().length >= 2;
  const canNext2 = parseFloat(bankroll) > 0;
  const canFinish = niveau !== "";

  return (
    <div style={ob.root}>
      <div style={ob.bgGrid} />
      {/* Scrollable wrapper — évite que le clavier iPhone cache le bouton */}
      <div style={ob.scroll}>
        <div style={{ ...ob.card, maxWidth: isMobile ? "100%" : 440, borderRadius: isMobile ? 20 : 18 }}>
          <div style={ob.logoRow}>
            <SportsAvatar size={isMobile ? 44 : 52} />
            <div>
              <div style={{ ...ob.logoName, fontSize: isMobile ? 20 : 22 }}>SquadBet</div>
              <div style={ob.logoSub}>Expert Paris Sportifs</div>
            </div>
          </div>

          <div style={ob.dots}>
            {[1,2,3].map(i => <div key={i} style={{ ...ob.dot, ...(step>=i?ob.dotOn:{}) }} />)}
          </div>

          <div style={{ opacity:animating?0:1, transition:"opacity 0.28s" }}>
            {step===1 && (
              <div style={ob.stepWrap}>
                <div style={ob.stepTitle}>Bienvenue 👋</div>
                <div style={ob.stepSub}>Choisis ton pseudo. Il apparaîtra dans ton espace personnel.</div>
                <div style={ob.inputWrap}>
                  <div style={ob.inputLabel}>Ton pseudo</div>
                  <input style={ob.input} placeholder="Ex: LeBossDesParis" value={pseudo}
                    onChange={e=>setPseudo(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&canNext1&&nextStep()}
                    autoComplete="off" maxLength={20} />
                  <div style={ob.inputHint}>{pseudo.length}/20 caractères</div>
                </div>
                <button style={{ ...ob.btn, opacity:canNext1?1:0.35, marginTop:8 }} onClick={nextStep} disabled={!canNext1}>Continuer →</button>
              </div>
            )}
            {step===2 && (
              <div style={ob.stepWrap}>
                <div style={ob.stepTitle}>Ta Bankroll 💰</div>
                <div style={ob.stepSub}>Le budget que tu alloues aux paris. Ne mets jamais plus que ce que tu peux perdre.</div>
                <div style={ob.inputWrap}>
                  <div style={ob.inputLabel}>Montant (€)</div>
                  <div style={ob.eurWrap}>
                    <span style={ob.eurSign}>€</span>
                    <input style={{ ...ob.input, paddingLeft:36 }} placeholder="Ex: 200" value={bankroll}
                      onChange={e=>setBankroll(e.target.value.replace(/[^0-9.]/g,""))}
                      onKeyDown={e=>e.key==="Enter"&&canNext2&&nextStep()}
                      type="number" inputMode="numeric" min="10" />
                  </div>
                  <div style={ob.bankrollSuggest}>
                    {[50,100,200,500].map(v=>(
                      <button key={v} style={{ ...ob.chip, ...(bankroll===String(v)?ob.chipOn:{}) }} onClick={()=>setBankroll(String(v))}>{v}€</button>
                    ))}
                  </div>
                  <div style={ob.inputHint}>💡 Commence avec un montant confortable.</div>
                </div>
                <div style={{ display:"flex", gap:10, marginTop:8 }}>
                  <button style={ob.btnBack} onClick={()=>setStep(1)}>← Retour</button>
                  <button style={{ ...ob.btn, flex:1, opacity:canNext2?1:0.35 }} onClick={nextStep} disabled={!canNext2}>Continuer →</button>
                </div>
              </div>
            )}
            {step===3 && (
              <div style={ob.stepWrap}>
                <div style={ob.stepTitle}>Ton Niveau 🎯</div>
                <div style={ob.stepSub}>SquadBet adapte ses conseils à ton profil.</div>
                <div style={ob.levelGrid}>
                  {LEVELS.map(lv=>(
                    <button key={lv.id} style={{ ...ob.levelBtn, ...(niveau===lv.id?ob.levelBtnOn:{}) }} onClick={()=>setNiveau(lv.id)}>
                      <span style={{ fontSize:24 }}>{lv.icon}</span>
                      <span style={ob.levelLabel}>{lv.label}</span>
                      <span style={ob.levelDesc}>{lv.desc}</span>
                    </button>
                  ))}
                </div>
                <div style={{ display:"flex", gap:10, marginTop:8 }}>
                  <button style={ob.btnBack} onClick={()=>setStep(2)}>← Retour</button>
                  <button style={{ ...ob.btn, flex:1, opacity:canFinish?1:0.35 }} onClick={handleFinish} disabled={!canFinish}>Lancer SquadBet 🚀</button>
                </div>
              </div>
            )}
          </div>
          <div style={ob.disclaimer}>⚠️ Paris sportifs réservés aux +18 ans. Jouez de façon responsable.</div>
        </div>
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%;overflow:hidden}
        input:focus{border-color:rgba(212,175,55,0.5)!important;outline:none}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
      `}</style>
    </div>
  );
}

const ob = {
  root:{ height:"100dvh", background:"#080810", display:"flex", flexDirection:"column", fontFamily:"'DM Sans',sans-serif", position:"relative" },
  bgGrid:{ position:"fixed", inset:0, backgroundImage:"linear-gradient(rgba(212,175,55,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(212,175,55,0.025) 1px,transparent 1px)", backgroundSize:"48px 48px", pointerEvents:"none" },
  scroll:{ flex:1, overflowY:"auto", WebkitOverflowScrolling:"touch", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"20px 16px", position:"relative", zIndex:1 },
  card:{ width:"100%", maxWidth:480, background:"rgba(12,12,20,0.99)", border:"1px solid rgba(212,175,55,0.2)", padding:"28px 22px 36px", boxShadow:"0 0 60px rgba(0,0,0,0.5)", borderRadius:20 },
  logoRow:{ display:"flex", alignItems:"center", gap:12, marginBottom:24, paddingBottom:18, borderBottom:"1px solid rgba(212,175,55,0.1)" },
  logoName:{ fontFamily:"'Playfair Display',serif", fontSize:22, color:"#D4AF37" },
  logoSub:{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:2 },
  dots:{ display:"flex", gap:8, justifyContent:"center", marginBottom:24 },
  dot:{ width:8, height:8, borderRadius:"50%", background:"rgba(255,255,255,0.1)", transition:"all 0.3s" },
  dotOn:{ background:"#D4AF37", boxShadow:"0 0 8px rgba(212,175,55,0.6)", width:24, borderRadius:4 },
  stepWrap:{ display:"flex", flexDirection:"column", gap:16, animation:"fadeUp 0.3s ease" },
  stepTitle:{ fontFamily:"'Playfair Display',serif", fontSize:22, color:"rgba(255,255,255,0.92)" },
  stepSub:{ fontSize:13, color:"rgba(255,255,255,0.4)", lineHeight:1.6 },
  inputWrap:{ display:"flex", flexDirection:"column", gap:8 },
  inputLabel:{ fontSize:11, color:"rgba(255,255,255,0.35)", letterSpacing:"0.8px", textTransform:"uppercase" },
  input:{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(212,175,55,0.2)", borderRadius:12, padding:"14px 16px", color:"rgba(255,255,255,0.9)", fontSize:16, fontFamily:"'DM Sans',sans-serif", width:"100%", transition:"border-color 0.2s", WebkitAppearance:"none" },
  inputHint:{ fontSize:11, color:"rgba(255,255,255,0.22)" },
  eurWrap:{ position:"relative" },
  eurSign:{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:"rgba(212,175,55,0.6)", fontSize:16, fontWeight:600, pointerEvents:"none" },
  bankrollSuggest:{ display:"flex", gap:8, flexWrap:"wrap" },
  chip:{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(212,175,55,0.15)", borderRadius:20, padding:"8px 16px", color:"rgba(255,255,255,0.45)", fontSize:14, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all 0.15s", minHeight:44 },
  chipOn:{ background:"rgba(212,175,55,0.15)", border:"1px solid rgba(212,175,55,0.4)", color:"#D4AF37" },
  levelGrid:{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 },
  levelBtn:{ display:"flex", flexDirection:"column", alignItems:"center", gap:5, padding:"14px 10px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(212,175,55,0.1)", borderRadius:14, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all 0.2s", minHeight:90 },
  levelBtnOn:{ background:"rgba(212,175,55,0.12)", border:"1px solid rgba(212,175,55,0.4)", boxShadow:"0 0 16px rgba(212,175,55,0.1)" },
  levelLabel:{ fontSize:13, fontWeight:600, color:"rgba(255,255,255,0.8)" },
  levelDesc:{ fontSize:10.5, color:"rgba(255,255,255,0.35)", textAlign:"center" },
  btn:{ background:"linear-gradient(135deg,#D4AF37,#8B7320)", border:"none", borderRadius:12, padding:"15px 20px", color:"#080810", fontWeight:700, fontSize:15, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"opacity 0.2s", minHeight:50 },
  btnBack:{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, padding:"15px 16px", color:"rgba(255,255,255,0.4)", fontWeight:500, fontSize:14, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", minHeight:50 },
  disclaimer:{ textAlign:"center", fontSize:10, color:"rgba(255,255,255,0.18)", marginTop:20, letterSpacing:"0.3px" },
};

// ─── THÈMES ───────────────────────────────────────────────────────────────────
const THEME_DARK = {
  bg:         "#080810",
  bgCard:     "rgba(255,255,255,0.025)",
  bgSidebar:  "rgba(8,8,16,0.99)",
  bgInput:    "rgba(255,255,255,0.04)",
  bgInputArea:"rgba(0,0,0,0.3)",
  bgTopBar:   "rgba(8,8,16,0.98)",
  bgBottomNav:"rgba(8,8,16,0.98)",
  bgSugg:     "rgba(255,255,255,0.03)",
  bgBubbleAI: "rgba(255,255,255,0.04)",
  border:     "rgba(212,175,55,0.1)",
  borderInput:"rgba(212,175,55,0.15)",
  borderNav:  "rgba(212,175,55,0.12)",
  text:       "rgba(255,255,255,0.85)",
  textMuted:  "rgba(255,255,255,0.4)",
  textFaint:  "rgba(255,255,255,0.25)",
  gold:       "#D4AF37",
  shadow:     "0 4px 24px rgba(0,0,0,0.4)",
  gridLine:   "rgba(212,175,55,0.02)",
  transition: "background 0.35s ease, color 0.35s ease, border-color 0.35s ease",
};

const THEME_LIGHT = {
  bg:         "#F8F6F0",
  bgCard:     "rgba(255,255,255,0.9)",
  bgSidebar:  "rgba(255,253,245,0.99)",
  bgInput:    "rgba(255,255,255,0.95)",
  bgInputArea:"rgba(248,246,240,0.98)",
  bgTopBar:   "rgba(255,253,245,0.98)",
  bgBottomNav:"rgba(255,253,245,0.98)",
  bgSugg:     "rgba(212,175,55,0.07)",
  bgBubbleAI: "rgba(255,255,255,0.95)",
  border:     "rgba(212,175,55,0.25)",
  borderInput:"rgba(212,175,55,0.3)",
  borderNav:  "rgba(212,175,55,0.2)",
  text:       "rgba(20,16,8,0.85)",
  textMuted:  "rgba(20,16,8,0.45)",
  textFaint:  "rgba(20,16,8,0.28)",
  gold:       "#9A7A1A",
  shadow:     "0 4px 24px rgba(180,160,80,0.12)",
  gridLine:   "rgba(212,175,55,0.06)",
  transition: "background 0.35s ease, color 0.35s ease, border-color 0.35s ease",
};

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function BettingAdvisor() {
  const getSavedProfile = () => { try { const p=localStorage.getItem("squadbet_profile"); return p?JSON.parse(p):null; } catch(e){return null;} };
  const [profile, setProfile] = useState(getSavedProfile);
  const isMobile = useIsMobile();
  const { toggle: toggleTheme, isDark } = useTheme();
  const T = isDark ? THEME_DARK : THEME_LIGHT;
  const s = getS(T);
  const m = getM(T);

  const [view, setView] = useState("chat");
  const [sport, setSport] = useState("all");
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSugg, setShowSugg] = useState(true);
  const [bankroll, setBankroll] = useState(profile?.bankroll||200);
  const [bankrollInput, setBankrollInput] = useState(String(profile?.bankroll||200));
  const [editingBR, setEditingBR] = useState(false);
  const [showAddBet, setShowAddBet] = useState(false);
  const [newBet, setNewBet] = useState({ match:"", sport:"football", type:"", cote:"", mise:"" });
  const [bets, setBets] = useState([]);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const chatAreaRef = useRef(null);

  const getInitialMsg = useCallback((p) => ({
    role:"assistant",
    content:`Bienvenue **${p.pseudo}** sur SquadBet ! 👋\n\nProfil **${LEVELS.find(l=>l.id===p.niveau)?.label}** — Bankroll **${p.bankroll}€** — Mes conseils sont adaptés à ton niveau.\n\n🎯 Dis-moi sur quel match ou sujet tu veux travailler.`,
  }), []);

  useEffect(() => {
    if (profile && messages.length === 0) setMessages([getInitialMsg(profile)]);
  }, [profile, getInitialMsg, messages.length]);

  useEffect(() => {
    if (bottomRef.current && view === "chat") {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:"smooth", block:"end" }), 50);
    }
  }, [messages, loading, view]);

  if (!profile) return <OnboardingScreen onComplete={p => { setProfile(p); setBankroll(p.bankroll); setBankrollInput(String(p.bankroll)); }} />;

  const totalGains = bets.reduce((a,b)=>a+b.gain,0);
  const totalMises = bets.reduce((a,b)=>a+b.mise,0);
  const resolved = bets.filter(b=>b.statut!=="en cours");
  const wins = bets.filter(b=>b.statut==="gagné");
  const roi = totalMises>0?((totalGains/totalMises)*100).toFixed(1):0;
  const winRate = resolved.length>0?((wins.length/resolved.length)*100).toFixed(0):0;
  const avgCote = bets.length>0?(bets.reduce((a,b)=>a+b.cote,0)/bets.length).toFixed(2):0;

  const sendMessage = async (text) => {
    const userMsg = text||input.trim();
    if (!userMsg||loading) return;
    setInput(""); setShowSugg(false);
    if (inputRef.current) inputRef.current.style.height = "44px";
    const newMsg = { role:"user", content:userMsg };
    const updatedHist = [...history, newMsg];
    setMessages(prev=>[...prev, newMsg]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ model:"gemini-1.5-flash", max_tokens:3000,
          system: SYSTEM_PROMPT + `\n\nProfil utilisateur : pseudo "${profile.pseudo}", niveau "${profile.niveau}", bankroll actuelle ${bankroll}€.`,
          messages: updatedHist }),
      });
      const data = await res.json();
      // Assemble tous les blocs texte (le bot peut faire web_search avant de répondre)
      const txt = data.content
        ?.filter(block => block.type === "text")
        ?.map(block => block.text)
        ?.join("\n")
        || (data.error ? `⚠️ API : ${data.error.message || JSON.stringify(data.error)}` : "Je n'ai pas pu analyser ça.");
      // Pour l'historique on garde le format attendu par l'API
      const aiMsg = { role:"assistant", content: data.content || [{ type:"text", text:txt }] };
      setHistory([...updatedHist, aiMsg]);
      setMessages(prev=>[...prev, { role:"assistant", content:txt }]);
    } catch(err) {
      const errMsg = err?.message || String(err);
      setMessages(prev=>[...prev, { role:"assistant", content:`⚠️ Erreur : ${errMsg}` }]);
    } finally { setLoading(false); }
  };

  const addBet = () => {
    if (!newBet.match||!newBet.cote||!newBet.mise) return;
    const mise=parseFloat(newBet.mise), cote=parseFloat(newBet.cote);
    setBets(prev=>[{ id:Date.now(), ...newBet, cote, mise, statut:"en cours", date:new Date().toLocaleDateString("fr-FR"), gain:0 }, ...prev]);
    setNewBet({ match:"", sport:"football", type:"", cote:"", mise:"" });
    setShowAddBet(false);
    setBankroll(br=>br-mise);
  };

  const updateBetStatus = (id, statut) => {
    setBets(prev=>prev.map(b=>{
      if (b.id!==id) return b;
      const gain = statut==="gagné"?parseFloat(((b.cote-1)*b.mise).toFixed(2)):-b.mise;
      if (statut==="gagné") setBankroll(br=>br+b.mise+gain);
      return { ...b, statut, gain };
    }));
  };

  const fmt = (text) => text
    .replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>")
    .replace(/\*(.*?)\*/g,"<em>$1</em>")
    .replace(/\n/g,"<br/>");

  const handleTextareaChange = (e) => {
    setInput(e.target.value);
    e.target.style.height = "44px";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  // ── LAYOUT VARS ────────────────────────────────────────────────────────────
  const SIDEBAR_W = isMobile ? 0 : 230;

  return (
    <div style={{ height:"100dvh", width:"100vw", background:T.bg, display:"flex", flexDirection:"column", fontFamily:"'DM Sans',sans-serif", position:"relative", overflow:"hidden", transition:T.transition }}>
      <div style={s.bgGrid} />

      {/* ── DESKTOP SIDEBAR ── */}
      {!isMobile && (
        <aside style={{ ...s.sidebar, position:"fixed", left:0, top:0, height:"100vh", zIndex:10 }}>
          <div style={s.sideTop}>
            <div style={s.logo}>
              <SportsAvatar size={40} />
              <div>
                <div style={s.logoName}>SquadBet</div>
                <div style={s.logoSub}>Expert Paris Sportifs</div>
              </div>
            </div>
            <div style={s.profilePill}>
              <div style={s.profileInfo}>
                <div style={s.profilePseudo}>👤 {profile.pseudo}</div>
                <div style={s.profileNiveau}>{LEVELS.find(l=>l.id===profile.niveau)?.icon} {LEVELS.find(l=>l.id===profile.niveau)?.label}</div>
              </div>
              <button style={s.profileReset} title="Changer de profil" onClick={() => { try{localStorage.removeItem("squadbet_profile")}catch(e){} setProfile(null); setMessages([]); }}>✕</button>
            </div>
            <div style={s.bankCard}>
              <div style={s.bankLabel}>💰 Bankroll</div>
              {editingBR ? (
                <div style={{ display:"flex", gap:6 }}>
                  <input style={s.bankInput} value={bankrollInput} onChange={e=>setBankrollInput(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"){ setBankroll(parseFloat(bankrollInput)||0); setEditingBR(false); }}} autoFocus inputMode="numeric" />
                  <button style={s.bankSave} onClick={()=>{ setBankroll(parseFloat(bankrollInput)||0); setEditingBR(false); }}>✓</button>
                </div>
              ) : (
                <div style={s.bankAmount} onClick={()=>{ setBankrollInput(String(bankroll)); setEditingBR(true); }}>
                  {bankroll.toFixed(2)} € <span style={s.editHint}>✎</span>
                </div>
              )}
              <div style={s.bankMeta}>Net : <span style={{ color:totalGains>=0?"#22c55e":"#ef4444" }}>{totalGains>=0?"+":""}{totalGains.toFixed(2)}€</span></div>
            </div>
            <nav style={s.nav}>
              {NAV_ITEMS.map(item=>(
                <button key={item.id} style={{ ...s.navBtn, ...(view===item.id?s.navBtnOn:{}) }} onClick={()=>setView(item.id)}>
                  <span>{item.icon}</span><span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
          <div style={s.sideBot}>
            {/* Bouton thème */}
            <button onClick={toggleTheme} style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", background:`rgba(212,175,55,${isDark?0.06:0.1})`, border:`1px solid ${T.border}`, borderRadius:9, padding:"10px 12px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", marginBottom:10, transition:T.transition }}>
              <span style={{ fontSize:12, color:T.textMuted }}>Thème</span>
              <span style={{ fontSize:18 }}>{isDark ? "☀️" : "🌙"}</span>
            </button>
            <div style={{ ...s.warnBox, background:`rgba(239,68,68,${isDark?0.05:0.04})`, border:`1px solid rgba(239,68,68,${isDark?0.15:0.2})` }}>
              <div style={s.warnTitle}>⚠️ Jeu Responsable</div>
              <div style={{ ...s.warnText, color:T.textFaint }}>Ne misez que ce que vous pouvez vous permettre de perdre. Interdit aux mineurs.</div>
            </div>
          </div>
        </aside>
      )}

      {/* ── MOBILE TOP BAR ── */}
      {isMobile && (
        <div style={m.topBar}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <SportsAvatar size={32} />
            <div>
              <div style={m.topBarName}>SquadBet</div>
              <div style={m.topBarSub}>👤 {profile.pseudo} · {bankroll.toFixed(0)}€</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <button onClick={toggleTheme} style={{ background:`rgba(212,175,55,${isDark?0.08:0.12})`, border:`1px solid ${T.border}`, borderRadius:8, width:36, height:36, cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center", WebkitTapHighlightColor:"transparent" }}>
              {isDark ? "☀️" : "🌙"}
            </button>
            <button style={{ ...m.topBarReset, color:T.textMuted, background:`rgba(212,175,55,${isDark?0.05:0.08})`, border:`1px solid ${T.border}` }} onClick={()=>{ try{localStorage.removeItem("squadbet_profile")}catch(e){} setProfile(null); setMessages([]); }}>✕</button>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex:1, marginLeft: isMobile?0:SIDEBAR_W, display:"flex", flexDirection:"column", overflow:"hidden", position:"relative", zIndex:1 }}>

        {/* ══ CHAT ══ */}
        {view==="chat" && (
          <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden", position:"relative" }}>
            {/* Sport filter bar */}
            <div style={{ ...s.topBar, overflowX:"auto", flexWrap:"nowrap", WebkitOverflowScrolling:"touch", scrollbarWidth:"none" }}>
              {SPORTS.map(sp=>(
                <button key={sp.id} style={{ ...s.sportBtn, ...(sport===sp.id?s.sportBtnOn:{}), flexShrink:0, minHeight:isMobile?40:32, padding: isMobile?"8px 12px":"5px 11px" }}
                  onClick={()=>{ setSport(sp.id); setShowSugg(true); }}>
                  {sp.icon} {sp.label}
                </button>
              ))}
              <button style={{ ...s.clearBtn, flexShrink:0, minHeight:isMobile?40:32 }} onClick={()=>{ setMessages([getInitialMsg(profile)]); setHistory([]); setShowSugg(true); }}>🗑</button>
            </div>

            {/* Messages */}
            <div ref={chatAreaRef} style={{ flex:1, overflowY:"auto", padding: isMobile?"14px 12px":"18px", display:"flex", flexDirection:"column", gap:12, WebkitOverflowScrolling:"touch" }}>
              {messages.map((msg,i)=>(
                <div key={i} style={{ ...s.msgRow, justifyContent:msg.role==="user"?"flex-end":"flex-start" }}>
                  {msg.role==="assistant" && <SportsAvatar size={isMobile?24:26} />}
                  <div style={{ ...(msg.role==="user"?s.userBubble:s.aiBubble), maxWidth:isMobile?"85%":"80%", fontSize:isMobile?14:13.5 }}
                    dangerouslySetInnerHTML={{ __html:fmt(msg.content) }} />
                </div>
              ))}
              {loading && (
                <div style={{ ...s.msgRow, justifyContent:"flex-start" }}>
                  <SportsAvatar size={isMobile?24:26} />
                  <div style={s.aiBubble}>
                    <div style={{ display:"flex", gap:5 }}>
                      {[0,0.2,0.4].map((d,i)=><span key={i} style={{ ...s.tdot, animationDelay:`${d}s` }} />)}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} style={{ height:1 }} />
            </div>

            {/* Suggestions */}
            {showSugg && (
              <div style={{ padding: isMobile?"0 12px 8px":"0 18px 10px", flexShrink:0 }}>
                <div style={s.suggLabel}>Suggestions rapides</div>
                <div style={{ display:"flex", gap:6, overflowX:"auto", WebkitOverflowScrolling:"touch", scrollbarWidth:"none", paddingBottom:4 }}>
                  {(QUICK_PROMPTS[sport]||QUICK_PROMPTS.all).map((q,i)=>(
                    <button key={i} style={{ ...s.suggBtn, flexShrink:0, minHeight:isMobile?40:32, padding: isMobile?"8px 14px":"5px 12px", fontSize: isMobile?13:11.5 }} onClick={()=>sendMessage(q)}>{q}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Input — position sticky évite la remontée sur Safari iOS */}
            <div style={{ ...s.inputArea, padding: isMobile?"10px 12px":"12px 18px", paddingBottom: isMobile ? `calc(10px + env(safe-area-inset-bottom, 0px))` : "12px", position:"sticky", bottom:0, zIndex:20 }}>
              <textarea ref={inputRef} style={{ ...s.textarea, fontSize:16, minHeight:44, maxHeight:isMobile?100:120, height:44, padding: isMobile?"12px 14px":"10px 14px" }}
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey&&!isMobile){ e.preventDefault(); sendMessage(); }}}
                onFocus={()=>{ setTimeout(()=>bottomRef.current?.scrollIntoView({ behavior:"smooth", block:"end" }), 400); }}
                placeholder="Analyse un match, stratégie bankroll..."
                rows={1} />
              <button style={{ ...s.sendBtn, width:isMobile?48:38, height:isMobile?48:38, borderRadius:isMobile?14:9, fontSize:isMobile?18:14, opacity:input.trim()&&!loading?1:0.35 }}
                onClick={()=>sendMessage()} disabled={!input.trim()||loading}>▲</button>
            </div>
          </div>
        )}

        {/* ══ CALCULATEURS ══ */}
        {view==="bankroll" && (
          <div style={{ ...s.pageView, paddingBottom: isMobile?`calc(24px + env(safe-area-inset-bottom, 0px))`:24 }}>
            {/* Mobile bankroll edit */}
            {isMobile && (
              <div style={{ ...s.bankCard, marginBottom:16 }}>
                <div style={s.bankLabel}>💰 Ma Bankroll</div>
                {editingBR ? (
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <input style={{ ...s.bankInput, fontSize:20, padding:"6px 10px" }} value={bankrollInput} onChange={e=>setBankrollInput(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"){ setBankroll(parseFloat(bankrollInput)||0); setEditingBR(false); }}} autoFocus inputMode="numeric" />
                    <button style={{ ...s.bankSave, padding:"8px 16px", fontSize:16 }} onClick={()=>{ setBankroll(parseFloat(bankrollInput)||0); setEditingBR(false); }}>✓</button>
                  </div>
                ) : (
                  <div style={{ ...s.bankAmount, fontSize:26 }} onClick={()=>{ setBankrollInput(String(bankroll)); setEditingBR(true); }}>
                    {bankroll.toFixed(2)} € <span style={s.editHint}>✎</span>
                  </div>
                )}
                <div style={s.bankMeta}>Net : <span style={{ color:totalGains>=0?"#22c55e":"#ef4444" }}>{totalGains>=0?"+":""}{totalGains.toFixed(2)}€</span></div>
              </div>
            )}
            <div style={s.pageTitle}>📊 Calculateurs</div>
            <div style={s.pageSubtitle}>Outils pro pour optimiser tes mises</div>
            <div style={s.card}><div style={s.cardTitle}>🎯 Calcul Kelly</div><KellyCalc bankroll={bankroll} isDark={isDark} /></div>
            <div style={s.card}><div style={s.cardTitle}>💎 Détecteur Value Bet</div><ValueBetCalc isDark={isDark} /></div>
            <div style={s.card}><div style={s.cardTitle}>🔗 Simulateur Combiné</div><ComboCalc bankroll={bankroll} isDark={isDark} /></div>
          </div>
        )}

        {/* ══ HISTORIQUE ══ */}
        {view==="history" && (
          <div style={{ ...s.pageView, paddingBottom: isMobile?`calc(24px + env(safe-area-inset-bottom, 0px))`:24 }}>
            <div style={s.histHeader}>
              <div>
                <div style={s.pageTitle}>📋 Mes Paris</div>
                <div style={s.pageSubtitle}>{bets.length} paris · {bankroll.toFixed(2)}€</div>
              </div>
              <button style={{ ...s.addBtn, minHeight:44, padding:"10px 16px" }} onClick={()=>setShowAddBet(!showAddBet)}>+ Ajouter</button>
            </div>
            {showAddBet && (
              <div style={{ ...s.card, marginBottom:14 }}>
                <div style={s.cardTitle}>➕ Nouveau Pari</div>
                <div style={{ display:"flex", flexDirection:"column", gap:10, marginTop:10 }}>
                  <input style={s.formInput} placeholder="Match (ex: PSG vs Lyon)" value={newBet.match} onChange={e=>setNewBet({...newBet, match:e.target.value})} />
                  <select style={s.formInput} value={newBet.sport} onChange={e=>setNewBet({...newBet, sport:e.target.value})}>
                    {SPORTS.filter(sp=>sp.id!=="all").map(sp=><option key={sp.id} value={sp.id}>{sp.icon} {sp.label}</option>)}
                  </select>
                  <input style={s.formInput} placeholder="Type (ex: 1, BTTS, Over 2.5)" value={newBet.type} onChange={e=>setNewBet({...newBet, type:e.target.value})} />
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    <input style={s.formInput} placeholder="Cote" type="number" step="0.01" inputMode="decimal" value={newBet.cote} onChange={e=>setNewBet({...newBet, cote:e.target.value})} />
                    <input style={s.formInput} placeholder="Mise (€)" type="number" inputMode="numeric" value={newBet.mise} onChange={e=>setNewBet({...newBet, mise:e.target.value})} />
                  </div>
                  <button style={{ ...s.addBtn, minHeight:48 }} onClick={addBet}>Enregistrer le pari</button>
                </div>
              </div>
            )}
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {bets.map(bet=>(
                <div key={bet.id} style={{ ...s.betRow, flexDirection: isMobile?"column":"row", alignItems: isMobile?"stretch":"center", gap: isMobile?10:0 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ ...s.betMatch, fontSize: isMobile?15:13.5 }}>{bet.match}</div>
                    <div style={s.betMeta}>
                      <span>{SPORTS.find(x=>x.id===bet.sport)?.icon} {bet.sport}</span>
                      <span>·</span><span style={{ color:"rgba(212,175,55,0.6)" }}>{bet.type}</span>
                      <span>·</span><span>{bet.date}</span>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:10, alignItems:"center", justifyContent: isMobile?"space-between":"flex-end" }}>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <span style={{ ...s.betCote, fontSize: isMobile?14:12.5 }}>@{bet.cote}</span>
                      <span style={{ ...s.betMise, fontSize: isMobile?14:12.5 }}>{bet.mise}€</span>
                    </div>
                    {bet.statut==="en cours" ? (
                      <div style={{ display:"flex", gap:8 }}>
                        <button style={{ ...s.winBtn, width:isMobile?44:28, height:isMobile?44:28, borderRadius:isMobile?10:5, fontSize:isMobile?18:13 }} onClick={()=>updateBetStatus(bet.id,"gagné")}>✓</button>
                        <button style={{ ...s.loseBtn, width:isMobile?44:28, height:isMobile?44:28, borderRadius:isMobile?10:5, fontSize:isMobile?18:13 }} onClick={()=>updateBetStatus(bet.id,"perdu")}>✗</button>
                      </div>
                    ) : (
                      <span style={{ fontSize:isMobile?16:14, fontWeight:700, color:bet.gain>=0?"#22c55e":"#ef4444" }}>
                        {bet.gain>=0?"+":""}{bet.gain}€
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ STATS ══ */}
        {view==="stats" && (
          <div style={{ ...s.pageView, paddingBottom: isMobile?`calc(24px + env(safe-area-inset-bottom, 0px))`:24 }}>
            <div style={s.pageTitle}>📈 Statistiques</div>
            <div style={s.pageSubtitle}>Performance sur {resolved.length} paris résolus</div>
            <div style={{ ...s.statsGrid, gridTemplateColumns: isMobile?"repeat(2,1fr)":"repeat(3,1fr)" }}>
              {[
                { label:"Taux de réussite", value:`${winRate}%`, color:"#D4AF37", icon:"🎯" },
                { label:"ROI", value:`${roi}%`, color:totalGains>=0?"#22c55e":"#ef4444", icon:"💰" },
                { label:"Gains nets", value:`${totalGains>=0?"+":""}${totalGains.toFixed(2)}€`, color:totalGains>=0?"#22c55e":"#ef4444", icon:"📊" },
                { label:"Cote moyenne", value:avgCote, color:"#a78bfa", icon:"📐" },
                { label:"Paris gagnés", value:`${wins.length}/${bets.length}`, color:"#22c55e", icon:"✅" },
                { label:"Total misé", value:`${totalMises}€`, color:"rgba(255,255,255,0.6)", icon:"🏦" },
              ].map((stat,i)=>(
                <div key={i} style={{ ...s.statCard, padding: isMobile?"14px 10px":"16px 12px" }}>
                  <div style={{ fontSize: isMobile?26:24 }}>{stat.icon}</div>
                  <div style={{ fontSize: isMobile?20:22, fontWeight:700, color:stat.color, fontFamily:"'Playfair Display',serif" }}>{stat.value}</div>
                  <div style={{ fontSize: isMobile?10:11, color:"rgba(255,255,255,0.35)", letterSpacing:"0.3px", textAlign:"center" }}>{stat.label}</div>
                </div>
              ))}
            </div>
            <div style={s.card}>
              <div style={s.cardTitle}>Performance par Sport</div>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {SPORTS.filter(sp=>sp.id!=="all").map(sp=>{
                  const sb=bets.filter(b=>b.sport===sp.id&&b.statut!=="en cours");
                  if (!sb.length) return null;
                  const won=sb.filter(b=>b.statut==="gagné").length;
                  const pct=((won/sb.length)*100).toFixed(0);
                  return (
                    <div key={sp.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ width:isMobile?80:110, fontSize:12, color:"rgba(255,255,255,0.6)", flexShrink:0 }}>{sp.icon} {sp.label}</div>
                      <div style={{ flex:1, height:isMobile?8:6, background:"rgba(255,255,255,0.06)", borderRadius:4, overflow:"hidden" }}>
                        <div style={{ width:`${pct}%`, height:"100%", background:"linear-gradient(90deg,#D4AF37,#8B7320)", borderRadius:4, transition:"width 0.6s ease" }} />
                      </div>
                      <div style={{ width:80, fontSize:11, color:"rgba(255,255,255,0.4)", textAlign:"right", flexShrink:0 }}>{pct}% ({won}/{sb.length})</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ ...s.card, borderColor:"rgba(212,175,55,0.3)", background:"rgba(212,175,55,0.05)" }}>
              <div style={s.cardTitle}>💡 Conseil SquadBet</div>
              <div style={{ color:"rgba(255,255,255,0.65)", fontSize:isMobile?14:13, lineHeight:1.75 }}>
                {parseFloat(roi)>5
                  ?"✅ Excellent ROI ! Tu es au-dessus de la moyenne des parieurs professionnels. Continue à être rigoureux."
                  :parseFloat(roi)>0
                  ?"⚡ ROI positif — tu es dans la bonne direction. Concentre-toi sur les marchés où tu performes le mieux."
                  :"⚠️ ROI négatif. Revois ta sélection — qualité plutôt que quantité. Analyse tes paris perdants pour identifier des patterns."}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── MOBILE BOTTOM NAV ── */}
      {isMobile && (
        <div style={m.bottomNav}>
          {NAV_ITEMS.map(item=>(
            <button key={item.id} style={{ ...m.navBtn, ...(view===item.id?m.navBtnOn:{}) }} onClick={()=>setView(item.id)}>
              <span style={{ fontSize:22 }}>{item.icon}</span>
              <span style={{ fontSize:10, marginTop:2, fontWeight: view===item.id?700:400 }}>{item.label}</span>
            </button>
          ))}
          {/* Bouton thème dans la bottom nav */}
          <button onClick={toggleTheme} style={{ ...m.navBtn, minWidth:52 }}>
            <span style={{ fontSize:22 }}>{isDark ? "☀️" : "🌙"}</span>
            <span style={{ fontSize:10, marginTop:2 }}>{isDark ? "Jour" : "Nuit"}</span>
          </button>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
        body{background:${T.bg};overscroll-behavior:none;-webkit-font-smoothing:antialiased;position:fixed;width:100%;height:100%;transition:background 0.35s ease}
        html{height:100%;height:-webkit-fill-available}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-thumb{background:rgba(212,175,55,0.2);border-radius:4px}
        div::-webkit-scrollbar{display:none}
        @keyframes pulse{0%,100%{opacity:0.2}50%{opacity:1}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        textarea:focus,input:focus,select:focus{outline:none;border-color:rgba(212,175,55,0.5)!important}
        textarea{-webkit-appearance:none;appearance:none}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
        option{background:#0f0f1a;color:white}
        button{-webkit-tap-highlight-color:transparent;touch-action:manipulation}
        input,textarea,select{-webkit-tap-highlight-color:transparent;font-size:16px}
      `}</style>
    </div>
  );
}

// ─── DESKTOP STYLES ───────────────────────────────────────────────────────────
const getS = (T) => ({
  bgGrid:{ position:"fixed", inset:0, backgroundImage:`linear-gradient(${T.gridLine} 1px,transparent 1px),linear-gradient(90deg,${T.gridLine} 1px,transparent 1px)`, backgroundSize:"48px 48px", pointerEvents:"none", zIndex:0 },
  sidebar:{ width:230, background:T.bgSidebar, borderRight:`1px solid ${T.border}`, display:"flex", flexDirection:"column", justifyContent:"space-between", transition:T.transition },
  sideTop:{ padding:"18px 14px", display:"flex", flexDirection:"column", gap:18 },
  logo:{ display:"flex", alignItems:"center", gap:11, paddingBottom:14, borderBottom:"1px solid rgba(212,175,55,0.08)" },
  logoName:{ fontFamily:"'Playfair Display',serif", fontSize:14, color:"#D4AF37" },
  logoSub:{ fontSize:9.5, color:"rgba(255,255,255,0.3)", marginTop:2 },
  profilePill:{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"rgba(212,175,55,0.09)", border:`1px solid ${T.border}`, borderRadius:9, padding:"9px 12px" },
  profileInfo:{ display:"flex", flexDirection:"column", gap:3 },
  profilePseudo:{ fontSize:13, fontWeight:600, color:"rgba(255,255,255,0.8)" },
  profileNiveau:{ fontSize:10.5, color:"rgba(212,175,55,0.7)" },
  profileReset:{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:5, width:22, height:22, color:"rgba(255,255,255,0.3)", cursor:"pointer", fontSize:9 },
  bankCard:{ background:"rgba(212,175,55,0.06)", border:"1px solid rgba(212,175,55,0.15)", borderRadius:9, padding:"11px 13px" },
  bankLabel:{ fontSize:10, color:"rgba(255,255,255,0.35)", marginBottom:5, letterSpacing:"0.5px" },
  bankAmount:{ fontSize:21, fontWeight:700, color:"#D4AF37", cursor:"pointer", display:"flex", alignItems:"center", gap:7 },
  editHint:{ fontSize:12, color:"rgba(212,175,55,0.35)", fontWeight:400 },
  bankInput:{ background:"rgba(255,255,255,0.07)", border:"1px solid rgba(212,175,55,0.3)", borderRadius:6, padding:"4px 8px", color:"#D4AF37", fontSize:17, fontWeight:700, width:"100%", fontFamily:"'DM Sans',sans-serif" },
  bankSave:{ background:"#D4AF37", border:"none", borderRadius:6, padding:"4px 10px", color:"#080810", cursor:"pointer", fontWeight:700 },
  bankMeta:{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:5 },
  nav:{ display:"flex", flexDirection:"column", gap:3 },
  navBtn:{ display:"flex", alignItems:"center", gap:9, padding:"9px 11px", borderRadius:7, border:"none", background:"transparent", color:T.textMuted, fontSize:13, cursor:"pointer", textAlign:"left", fontFamily:"'DM Sans',sans-serif" },
  navBtnOn:{ background:"rgba(212,175,55,0.1)", color:"#D4AF37", border:"1px solid rgba(212,175,55,0.18)" },
  sideBot:{ padding:14 },
  warnBox:{ background:"rgba(239,68,68,0.05)", border:"1px solid rgba(239,68,68,0.15)", borderRadius:8, padding:"9px 11px" },
  warnTitle:{ fontSize:10.5, fontWeight:600, color:"#fca5a5", marginBottom:4 },
  warnText:{ fontSize:9.5, color:"rgba(255,255,255,0.25)", lineHeight:1.55 },
  topBar:{ display:"flex", alignItems:"center", gap:6, padding:"8px 12px", borderBottom:`1px solid ${T.border}`, flexShrink:0, background:T.bgTopBar },
  sportBtn:{ padding:"5px 11px", borderRadius:18, border:`1px solid ${T.border}`, background:"transparent", color:T.textMuted, fontSize:12, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" },
  sportBtnOn:{ background:"rgba(212,175,55,0.12)", border:"1px solid rgba(212,175,55,0.3)", color:"#D4AF37" },
  clearBtn:{ padding:"5px 10px", borderRadius:18, border:"1px solid rgba(255,255,255,0.07)", background:"transparent", color:"rgba(255,255,255,0.25)", fontSize:11, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" },
  msgRow:{ display:"flex", alignItems:"flex-end", gap:9, animation:"fadeUp 0.3s ease" },
  aiBubble:{ background:T.bgBubbleAI, border:`1px solid ${T.border}`, borderRadius:"14px 14px 14px 3px", padding:"12px 15px", color:T.text, fontSize:13.5, lineHeight:1.75, maxWidth:"80%", wordBreak:"break-word", transition:T.transition },
  userBubble:{ background:"linear-gradient(135deg,rgba(212,175,55,0.17),rgba(139,115,32,0.1))", border:"1px solid rgba(212,175,55,0.2)", borderRadius:"14px 14px 3px 14px", padding:"11px 14px", color:"rgba(255,255,255,0.9)", fontSize:13.5, lineHeight:1.65, maxWidth:"70%", wordBreak:"break-word" },
  tdot:{ display:"inline-block", width:7, height:7, borderRadius:"50%", background:"#D4AF37", animation:"pulse 1.2s infinite" },
  suggLabel:{ fontSize:10, color:"rgba(255,255,255,0.2)", letterSpacing:"1px", textTransform:"uppercase", marginBottom:7 },
  suggBtn:{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(212,175,55,0.13)", borderRadius:20, padding:"5px 12px", color:"rgba(255,255,255,0.45)", fontSize:12, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", whiteSpace:"nowrap" },
  inputArea:{ display:"flex", alignItems:"flex-end", gap:9, borderTop:`1px solid ${T.border}`, background:T.bgInputArea, flexShrink:0 },
  textarea:{ flex:1, background:T.bgInput, border:`1px solid ${T.borderInput}`, borderRadius:12, padding:"10px 14px", color:T.text, fontSize:16, fontFamily:"'DM Sans',sans-serif", resize:"none", lineHeight:1.5, overflowY:"auto", WebkitAppearance:"none" },
  sendBtn:{ borderRadius:12, background:"linear-gradient(135deg,#D4AF37,#8B7320)", border:"none", cursor:"pointer", color:"#080810", fontWeight:"bold", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  pageView:{ flex:1, overflowY:"auto", padding:"20px 16px", WebkitOverflowScrolling:"touch" },
  pageTitle:{ fontFamily:"'Playfair Display',serif", fontSize:20, color:T.gold, marginBottom:4 },
  pageSubtitle:{ fontSize:12.5, color:T.textFaint, marginBottom:18 },
  card:{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:14, padding:"16px", marginBottom:14, transition:T.transition },
  cardTitle:{ fontSize:13.5, fontWeight:600, color:T.textMuted, marginBottom:14 },
  calcField:{ display:"flex", flexDirection:"column", gap:8 },
  calcLabel:{ fontSize:13, color:T.textMuted },
  slider:{ width:"100%", accentColor:"#D4AF37", cursor:"pointer", height:6 },
  numInput:{ background:T.bgInput, border:`1px solid ${T.borderInput}`, borderRadius:10, padding:"12px 14px", color:T.text, fontSize:16, fontFamily:"'DM Sans',sans-serif", width:"100%", WebkitAppearance:"none" },
  calcResult:{ display:"flex", flexDirection:"column", gap:10, marginTop:6 },
  calcRow:{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:13, color:T.textMuted },
  addLegBtn:{ background:"transparent", border:"1px dashed rgba(212,175,55,0.2)", borderRadius:10, padding:"10px", color:"rgba(212,175,55,0.45)", fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", minHeight:44 },
  removeBtn:{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.18)", borderRadius:8, width:36, height:36, color:"#ef4444", cursor:"pointer", fontSize:14, flexShrink:0 },
  histHeader:{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 },
  addBtn:{ background:"linear-gradient(135deg,#D4AF37,#8B7320)", border:"none", borderRadius:10, padding:"8px 15px", color:"#080810", fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" },
  formInput:{ background:T.bgInput, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 14px", color:T.text, fontSize:16, fontFamily:"'DM Sans',sans-serif", width:"100%", WebkitAppearance:"none" },
  betRow:{ display:"flex", justifyContent:"space-between", alignItems:"center", background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:12, padding:"14px", animation:"fadeUp 0.2s ease" },
  betMatch:{ fontSize:13.5, color:T.text, fontWeight:500, marginBottom:4 },
  betMeta:{ display:"flex", gap:7, fontSize:11, color:"rgba(255,255,255,0.28)", alignItems:"center", flexWrap:"wrap" },
  betRight:{ display:"flex", gap:10, alignItems:"center" },
  betCote:{ fontSize:12.5, color:"#a78bfa", fontWeight:600 },
  betMise:{ fontSize:12.5, color:"rgba(255,255,255,0.5)" },
  winBtn:{ background:"rgba(34,197,94,0.12)", border:"1px solid rgba(34,197,94,0.25)", borderRadius:8, width:36, height:36, color:"#22c55e", cursor:"pointer", fontWeight:700, fontSize:16 },
  loseBtn:{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.22)", borderRadius:8, width:36, height:36, color:"#ef4444", cursor:"pointer", fontWeight:700, fontSize:16 },
  statsGrid:{ display:"grid", gap:10, marginBottom:14 },
  statCard:{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:12, padding:"16px 12px", display:"flex", flexDirection:"column", alignItems:"center", gap:5, textAlign:"center" },
});

// ─── MOBILE-ONLY STYLES ───────────────────────────────────────────────────────
const getM = (T) => ({
  topBar:{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 16px", paddingTop:"calc(10px + env(safe-area-inset-top, 0px))", background:T.bgTopBar, borderBottom:`1px solid ${T.border}`, flexShrink:0, zIndex:5, transition:T.transition },
  topBarName:{ fontFamily:"'Playfair Display',serif", fontSize:15, color:"#D4AF37" },
  topBarSub:{ fontSize:11, color:"rgba(255,255,255,0.35)", marginTop:1 },
  topBarReset:{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, width:36, height:36, color:"rgba(255,255,255,0.35)", cursor:"pointer", fontSize:12, display:"flex", alignItems:"center", justifyContent:"center" },
  bottomNav:{ display:"flex", alignItems:"stretch", background:T.bgBottomNav, borderTop:`1px solid ${T.borderNav}`, paddingBottom:"env(safe-area-inset-bottom, 0px)", flexShrink:0, zIndex:10, transition:T.transition },
  navBtn:{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, padding:"10px 4px", border:"none", background:"transparent", color:T.textMuted, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", minHeight:56, WebkitTapHighlightColor:"transparent" },
  navBtnOn:{ color:"#D4AF37" },
});
// Static fallback for sub-components (always dark)
const s = getS(THEME_DARK);


import { useState, useEffect, useRef } from "react";
import { Search, Loader2, Info, X, Key, ExternalLink, ChevronDown, Cpu } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────

interface Game {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  developerNames: string | null;
  genreNames: string | null;
  rating: number | null;
  releaseDate: string | null;
  tags?: Array<{ name: string; slug: string }>;
}

// ─── Gemini System Prompt (compressed for token savings) ─────────

const SYSTEM_INSTRUCTION = `You translate horror game search queries (and optional web search snippets) into a structured search DSL JSON object.
First, recommend up to 5 specific horror game titles that DIRECTLY answer the query in suggested_titles.
Second, provide fallback tags/filters in fallback_dsl.

══ HORROR GAME NICHE TAXONOMY ══
Use this to find the CLOSEST niche match — never recommend games from a different niche unless asked.

NICHE 1 — PSYCHOLOGICAL EXPLORATION HORROR
Slow-burn, first-person, haunted domestic spaces, objects/cameras, no combat or minimal.
Games: Visage, MADiSON, P.T., Layers of Fear, Layers of Fear 2, Observer, Haunting Grounds, The Mortuary Assistant, Paratopic, Anatomy, Martha is Dead, The Town of Light, Doki Doki Literature Club, Hellblade
Tags: psychological, first-person, slow-burn, isolated, supernatural, walking-sim

NICHE 2 — CREATURE STALKER HORROR
Relentless monster, no weapons, hide/run/stealth mechanics, oppressive dread.
Games: Outlast, Outlast 2, Outlast Trials, Alien: Isolation, Amnesia: The Dark Descent, Amnesia: Rebirth, FOBIA St. Dinfna Hotel, Soma, Carrion, Darkwood
Tags: survival-horror, stealth-no-combat, first-person, oppressive, high-tension

NICHE 3 — CO-OP GHOST HUNTING
Multiplayer ghost investigation, evidence gathering, shared supernatural threats.
Games: Phasmophobia, Demonologist, Ghost Exile, Forewarned, Devour, The Blackout Club, Kinetic, GTFO
Tags: co-op, supernatural, puzzle-horror, multiplayer

NICHE 4 — CLASSIC SURVIVAL HORROR
Third-person or fixed camera, resource management, puzzles, narrative.
Games: Resident Evil series, Silent Hill series, Alan Wake, The Evil Within, The Evil Within 2, Signalis, Alone in the Dark, Tormented Souls
Tags: survival-horror, third-person, puzzle-horror, narrative-horror

NICHE 5 — COSMIC / SCI-FI HORROR
Existential space or deep-sea dread, isolation, alien or machine threats.
Games: SOMA, Dead Space, Dead Space 2, Event[0], Observation, Barotrauma, Iron Lung, Prey, System Shock, Moons of Madness
Tags: cosmic-horror, setting-sci-fi, setting-space, setting-deep-sea, isolated

NICHE 6 — ANALOG / FOUND FOOTAGE HORROR
VHS aesthetic, camera mechanics, lo-fi presentation.
Games: Blair Witch, Dreadout, Fears to Fathom, Skinamarink, Midnight Scenes, Petscop, Imscared, Anatomy
Tags: setting-found-footage, vhs-analog, setting-analog, first-person, unsettling

NICHE 7 — RETRO / PS1-STYLE HORROR
Intentional PS1, CRT, or pixel aesthetics with dread.
Games: Crow Country, Signalis, Faith: The Unholy Trinity, Bloodwash, Dread Templar, Puppet Combo games, Mondo Medicals, LSD Dream Emulator
Tags: retro-ps1, pixel-art, crt-retro, vhs-analog

NICHE 8 — INDIE SURREAL HORROR
Experimental, liminal spaces, absurdist or existential dread, lo-fi.
Games: Paratopic, Anatomy, Norco, IMSCARED, Yume Nikki, Hypnospace Outlaw, Off-Peak, Milk inside a bag
Tags: liminal-surreal, psychological, walking-sim, unsettling, melancholic

NICHE 9 — ACTION HORROR
Combat-focused, cinematic, narrative-driven.
Games: Dead Space, The Callisto Protocol, The Evil Within 2, Resident Evil Village, Until Dawn, Little Nightmares, Little Nightmares 2, A Plague Tale: Innocence
Tags: action-horror, third-person, survival-horror, narrative-horror

NICHE 10 — ASYMMETRIC MULTIPLAYER HORROR
4v1 or team-based, competitive or cooperative survival.
Games: Dead by Daylight, Friday the 13th, The Texas Chain Saw Massacre, Evil Dead: The Game, Deceit, White Noise 2
Tags: multiplayer, co-op, action-horror, slasher, high-tension

NICHE 11 — NARRATIVE / WALKING SIM HORROR
Story-first, near-zero combat, emotional or psychological impact.
Games: SOMA, Martha is Dead, What Remains of Edith Finch, The Town of Light, Hellblade: Senua's Sacrifice, Celeste (mild), Tacoma
Tags: narrative-horror, walking-sim, psychological, melancholic

NICHE 12 — UNDERWATER / DEEP-SEA HORROR
Aquatic claustrophobia, oceanic dread.
Games: Iron Lung, Barotrauma, Subnautica, Dredge, SOMA, Song of the Deep, Abzu
Tags: setting-deep-sea, cosmic-horror, isolated

══ NICHE MATCHING RULE ══
Step 1 — Identify which NICHE(S) the reference game belongs to.
Step 2 — Recommend other games FROM THAT SAME NICHE in suggested_titles.
Step 3 — For hybrid queries (e.g. "like Alien Isolation but co-op"), combine niches.
Step 4 — Never recommend games from a DIFFERENT niche unless explicitly asked.

RULES:
1. Never include the reference game itself in suggested_titles.
2. If a specific game is mentioned (e.g. "like Visage"), set it as reference_title in fallback_dsl.
3. If web snippets are provided, extract game titles IN THOSE SNIPPETS first.
4. Prefer obscure accurate niche matches over broadly popular inaccurate ones.

VALID TAG SLUGS:
psychological, cosmic-horror, body-horror, liminal-surreal, folk-horror, slasher, mascot-horror, supernatural, zombie-apocalypse, creature-horror, comedy-horror,
setting-sci-fi, setting-cyberpunk, setting-medical, setting-space, setting-deep-sea, setting-rural, setting-urban, setting-industrial, setting-school, setting-analog, setting-found-footage,
survival-horror, stealth-no-combat, action-horror, narrative-horror, walking-sim, immersive-sim, puzzle-horror, point-click, visual-novel, text-based, rpg-maker, co-op, multiplayer,
retro-ps1, pixel-art, vhs-analog, hand-drawn, anime-style, photorealistic, fmv, stylized, black-white, crt-retro,
oppressive, slow-burn, high-tension, isolated, melancholic, jumpscare-heavy, unsettling, chaotic-panic, cozy-horror,
first-person, third-person, isometric, side-view, bird-view-top-down, text, virtual-reality.

EXAMPLES:
Q: "games like Visage or P.T." → {
  "suggested_titles": ["MADiSON", "Layers of Fear", "Observer", "Haunting Grounds", "The Mortuary Assistant"],
  "fallback_dsl": {"must_tags":["psychological","first-person"],"prefer_tags":["slow-burn","isolated","supernatural"],"reference_title":"Visage"}
}
Q: "games like MADiSON" → {
  "suggested_titles": ["Visage", "Layers of Fear", "P.T.", "Haunting Grounds", "The Mortuary Assistant"],
  "fallback_dsl": {"must_tags":["psychological","first-person"],"prefer_tags":["slow-burn","isolated","supernatural"],"reference_title":"MADiSON"}
}
Q: "co-op horror like Phasmophobia" → {
  "suggested_titles": ["Demonologist", "Forewarned", "Ghost Exile", "Devour"],
  "fallback_dsl": {"must_tags":["co-op"],"prefer_tags":["supernatural","puzzle-horror"],"reference_title":"Phasmophobia"}
}
Q: "alien isolation but co-op" → {
  "suggested_titles": ["Species: Unknown", "Aliens: Colonial Marines", "GTFO"],
  "fallback_dsl": {"must_tags":["co-op"],"prefer_tags":["survival-horror","first-person","setting-space"],"reference_title":"Alien: Isolation"}
}
Q: "ps1 style body horror without jumpscares" → {
  "suggested_titles": ["Crow Country", "Signalis", "Faith: The Unholy Trinity"],
  "fallback_dsl": {"must_tags":["body-horror","retro-ps1"],"exclude_tags":["jumpscare-heavy"]}
}`;

const DSL_SCHEMA = {
  type: "object",
  properties: {
    suggested_titles: { type: "array", items: { type: "string" } },
    fallback_dsl: {
      type: "object",
      properties: {
        must_tags: { type: "array", items: { type: "string" } },
        prefer_tags: { type: "array", items: { type: "string" } },
        exclude_tags: { type: "array", items: { type: "string" } },
        reference_title: { type: "string" },
        filters: {
          type: "object",
          properties: {
            release_after: { type: "string" },
            min_rating: { type: "number" },
            platforms: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
  },
};

// ─── Providers & Models ──────────────────────────────────────────

type Provider = "gemini" | "openrouter" | "groq";

const PROVIDER_CONFIG = {
  gemini: {
    label: "Google Gemini",
    keyPlaceholder: "AIzaSy...",
    keyLink: "https://aistudio.google.com/apikey",
    keyLinkLabel: "Google AI Studio",
    description: "Get a free key from Google AI Studio.",
    models: [
      { id: "gemini-2.0-flash", label: "2.0 Flash" },
      { id: "gemini-2.0-flash-lite", label: "2.0 Flash Lite" },
      { id: "gemini-2.5-flash-preview-05-20", label: "2.5 Flash Preview" },
      { id: "gemini-2.5-pro-preview-06-05", label: "2.5 Pro Preview" },
    ],
    defaultModel: "gemini-2.0-flash",
  },
  openrouter: {
    label: "OpenRouter",
    keyPlaceholder: "sk-or-v1-...",
    keyLink: "https://openrouter.ai/keys",
    keyLinkLabel: "OpenRouter Dashboard",
    description: "Works from any region. Load-balances automatically.",
    models: [
      { id: "openrouter/free", label: "Auto-Select Free Model" },
      { id: "meta-llama/llama-3-8b-instruct:free", label: "Llama 3 8B (free)" },
      { id: "qwen/qwen-2.5-72b-instruct:free", label: "Qwen 2.5 72B (free)" },
      { id: "google/gemma-2-9b-it:free", label: "Gemma 2 9B (free)" },
    ],
    defaultModel: "openrouter/free",
  },
  groq: {
    label: "Groq Cloud",
    keyPlaceholder: "gsk_...",
    keyLink: "https://console.groq.com/keys",
    keyLinkLabel: "Groq Console",
    description: "Incredibly fast LPU inference. Permanent free tier.",
    models: [
      { id: "groq/free", label: "Auto-Select Free Model" },
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Versatile)" },
      { id: "gemma2-9b-it", label: "Gemma 2 9B" },
      { id: "llama-3-8b-8192", label: "Llama 3 8B" },
    ],
    defaultModel: "groq/free",
  },
} as const;

function cleanJson(str: string): string {
  let cleaned = str.trim();
  
  // Remove markdown code blocks if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/, "");
    cleaned = cleaned.replace(/\s*```$/, "");
  }
  
  cleaned = cleaned.trim();
  
  // Find first '{' and last '}' to extract raw JSON
  const startIdx = cleaned.indexOf("{");
  const endIdx = cleaned.lastIndexOf("}");
  
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return cleaned.substring(startIdx, endIdx + 1);
  }
  
  return cleaned;
}

// ─── Suggestions ─────────────────────────────────────────────────

const SUGGESTIONS = [
  "co-op horror like Phasmophobia",
  "PS1 style body horror",
  "psychological horror in space",
  "games like Silent Hill 2",
  "slow burn atmospheric without jumpscares",
  "pixel art survival horror",
];

// ─── Component ───────────────────────────────────────────────────

export default function AISearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<string>("");
  const [displayPhase, setDisplayPhase] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDisplayPhase(phase);
  }, [phase]);

  useEffect(() => {
    let delayTimeout: NodeJS.Timeout;
    let rotationInterval: NodeJS.Timeout;

    if (loading) {
      // If it takes more than 1.2 seconds, show funny messages
      delayTimeout = setTimeout(() => {
        let msgIndex = 0;
        const funnyMessages = [
          "Scanning vibe matrix...",
          "Decrypting horror grid...",
          "Herding the ghosts...",
          "Calibrating exorcism equipment...",
          "Feeding the shadow demons...",
          "Running spatial containment scans...",
          "Reticulating splines...",
          "Spinning the hamster...",
          "Convincing AI not to turn evil...",
          "Assembling catalog entities...",
        ];
        
        setDisplayPhase(funnyMessages[0]);
        rotationInterval = setInterval(() => {
          msgIndex = (msgIndex + 1) % funnyMessages.length;
          setDisplayPhase(funnyMessages[msgIndex]);
        }, 1500);
      }, 1200);
    } else {
      setDisplayPhase("");
    }

    return () => {
      clearTimeout(delayTimeout);
      clearInterval(rotationInterval);
    };
  }, [loading]);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [provider, setProvider] = useState<Provider>("gemini");
  const [apiKey, setApiKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [model, setModel] = useState(PROVIDER_CONFIG.gemini.defaultModel);
  const [customModel, setCustomModel] = useState("");
  const [useCustomModel, setUseCustomModel] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedProvider = (localStorage.getItem("hg-ai-provider") || "gemini") as Provider;
      setProvider(savedProvider);
      const savedKey = localStorage.getItem("hg-ai-key") || "";
      setApiKey(savedKey);
      setKeyInput(savedKey);
      const cfg = PROVIDER_CONFIG[savedProvider];
      const savedModel = localStorage.getItem("hg-ai-model") || "";
      if (savedModel) {
        const isPreset = cfg.models.some((m) => m.id === savedModel);
        if (isPreset) {
          setModel(savedModel);
          setUseCustomModel(false);
        } else {
          setCustomModel(savedModel);
          setUseCustomModel(true);
        }
      } else {
        setModel(cfg.defaultModel);
      }
    }
  }, []);

  const cfg = PROVIDER_CONFIG[provider];
  const activeModel = useCustomModel ? customModel.trim() : model;

  const switchProvider = (p: Provider) => {
    setProvider(p);
    const newCfg = PROVIDER_CONFIG[p];
    setModel(newCfg.defaultModel);
    setUseCustomModel(false);
    setCustomModel("");
    // Load saved key for this provider
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem(`hg-ai-key-${p}`) || "";
      setApiKey(savedKey);
      setKeyInput(savedKey);
    }
  };

  const saveSettings = () => {
    const clean = keyInput.trim();
    setApiKey(clean);
    localStorage.setItem("hg-ai-provider", provider);
    localStorage.setItem("hg-ai-key", clean);
    localStorage.setItem(`hg-ai-key-${provider}`, clean);
    localStorage.setItem("hg-ai-model", activeModel || cfg.defaultModel);
    setShowSettings(false);
    setError("");
  };

  const clearKey = () => {
    setApiKey("");
    setKeyInput("");
    localStorage.removeItem("hg-gemini-key");
  };

  const hasKey = apiKey.length > 10;

  // Helper to enforce a strict timeout on any async Promise operation (e.g. fetch + json parsing)
  const withTimeout = <T,>(promise: Promise<T>, ms = 8000): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("TimeoutError"));
      }, ms);

      promise
        .then((res) => {
          clearTimeout(timer);
          resolve(res);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  };

  // ── Search Handler ──────────────────────────────────────────

  const handleSearch = async (searchQuery?: string) => {
    const q = (searchQuery || query).trim();
    if (!q) return;
    if (searchQuery) setQuery(searchQuery);

    setLoading(true);
    setError("");
    setPhase("");
    setHasSearched(true);

    try {
      // Stage 1: Check server cache & direct matches (fetch + json parsing capped at 8s combined)
      setPhase("Checking cache...");
      const data = await withTimeout(
        (async () => {
          const res = await fetch("/api/search/ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: q }),
          });
          if (!res.ok) throw new Error("Server error");
          return await res.json();
        })(),
        8000
      );

      if (data.status === "success" || data.status === "direct_match") {
        setResults(data.results || []);
        setPhase("");
        setLoading(false);
        return;
      }

      // Stage 2: Need AI translation
      if (data.status === "needs_translation") {
        if (!apiKey) {
          setError("This search hasn't been cached yet. Add an API key to translate new queries.");
          setShowSettings(true);
          setLoading(false);
          setPhase("");
          return;
        }

        const selectedModel = activeModel || cfg.defaultModel;
        const finalModel = selectedModel;

        // Step 2.5: Perform Web Search Discovery for real-time recommendations
        setPhase("Running web search...");
        let snippetsText = "";
        try {
          // Reformulate query to target community recommendation threads for precision
          const searchQuery = q.toLowerCase().includes(" like ") || q.toLowerCase().includes("similar")
            ? `${q} game recommendations reddit steam`
            : `horror games similar to ${q} recommendations reddit`;
          const webRes = await fetch(`/api/search/web?query=${encodeURIComponent(searchQuery)}`);
          if (webRes.ok) {
            const webData = await webRes.json();
            if (webData.results && webData.results.length > 0) {
              snippetsText = webData.results.map((r: any, idx: number) => `[Result ${idx + 1}] Title: ${r.title}\nSnippet: ${r.snippet}`).join("\n\n");
            }
          }
        } catch (e) {
          console.warn("⚠️ Web Search API failed, falling back to pure LLM generation:", e);
        }

        setPhase(`Translating via ${selectedModel}...`);

        const userPrompt = snippetsText 
          ? `Extract horror game recommendations from these web search snippets for the user query: "${q}".
             
             Web search snippets:
             ${snippetsText}
             
             Respond ONLY with the JSON matching the DSL schema. No other text.`
          : `Translate the user query into the horror game search DSL JSON.\nUser query: "${q}"`;

        let dslText: string | undefined;

        // Wrap the entire AI translation fetch and response body decoding in a 10s timeout
        dslText = await withTimeout(
          (async () => {
            if (provider === "openrouter") {
              const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${apiKey}`,
                  "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://gamegata.xyz",
                  "X-Title": "hoGAMEGATA AI Search",
                },
                body: JSON.stringify({
                  model: finalModel,
                  messages: [
                    { role: "system", content: SYSTEM_INSTRUCTION + "\n\nRespond ONLY with valid JSON matching the DSL schema. No explanation or markup." },
                    { role: "user", content: userPrompt },
                  ],
                  response_format: { type: "json_object" },
                }),
              });

              if (!orRes.ok) {
                const errData = await orRes.json().catch(() => ({}));
                throw new Error(errData?.error?.message || "OpenRouter request failed");
              }

              const orData = await orRes.json();
              return orData.choices?.[0]?.message?.content;
            } else if (provider === "groq") {
              const modelsToTry = finalModel === "groq/free" 
                ? ["llama-3.3-70b-versatile", "gemma2-9b-it", "mixtral-8x7b-32768", "llama-3.1-8b-instant"] 
                : [finalModel];

              let lastError = "Groq Cloud request failed";
              
              for (const modelId of modelsToTry) {
                try {
                  console.log(`🤖 Trying Groq model: ${modelId}`);
                  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Authorization": `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                      model: modelId,
                      messages: [
                        { role: "system", content: SYSTEM_INSTRUCTION + "\n\nRespond ONLY with valid JSON matching the DSL schema. No explanation or markdown blocks." },
                        { role: "user", content: userPrompt },
                      ],
                      response_format: { type: "json_object" },
                    }),
                  });

                  if (groqRes.ok) {
                    const groqData = await groqRes.json();
                    return groqData.choices?.[0]?.message?.content;
                  }
                  
                  const errData = await groqRes.json().catch(() => ({}));
                  lastError = errData?.error?.message || `Groq Cloud returned status ${groqRes.status}`;
                  console.warn(`⚠️ Groq model ${modelId} failed: ${lastError}`);
                } catch (e: any) {
                  lastError = e.message || "Network error";
                  console.error(`❌ Groq model ${modelId} crashed:`, e);
                }
              }
              
              throw new Error(lastError);
            } else {
              const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${finalModel}:generateContent?key=${apiKey}`;

              const geminiRes = await fetch(geminiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: userPrompt }] }],
                  generationConfig: { responseMimeType: "application/json", responseSchema: DSL_SCHEMA },
                  systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
                }),
              });

              if (!geminiRes.ok) {
                const errData = await geminiRes.json().catch(() => ({}));
                throw new Error(errData?.error?.message || "Invalid API key or rate limited");
              }

              const geminiData = await geminiRes.json();
              return geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
            }
          })(),
          10000
        );

        if (!dslText) throw new Error("AI returned empty response");

        const cleanedDslText = cleanJson(dslText);
        const dsl = JSON.parse(cleanedDslText);

        // Stage 3: Execute DSL (fetch + json parsing capped at 8s combined)
        setPhase("Running search...");
        const execData = await withTimeout(
          (async () => {
            const execRes = await fetch("/api/search/ai", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query: q, dsl }),
            });
            if (!execRes.ok) throw new Error("Search execution failed");
            return await execRes.json();
          })(),
          8000
        );

        setResults(execData.results || []);
        setPhase("");
      }
    } catch (err: any) {
      console.error("AI Search:", err);
      const isTimeout = err.message === "TimeoutError";
      setError(isTimeout ? "Request timed out. Please check your connection or try another provider." : (err.message || "Something went wrong"));

      // Fallback
      try {
        const fbData = await withTimeout(
          (async () => {
            const fb = await fetch(`/api/games?search=${encodeURIComponent(q)}&limit=12`);
            if (fb.ok) return await fb.json();
            throw new Error();
          })(),
          8000
        );
        setResults(fbData.games || []);
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch();
  };

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="w-full flex flex-col items-center">

      {/* ── Hero Search Area ─────────────────────────────── */}
      <div className="w-full flex flex-col items-center gap-6 pt-8 pb-12 sm:pt-12 sm:pb-16">

        {/* Title */}
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-sans font-black text-3xl sm:text-4xl tracking-tight text-white">
            Find your next nightmare
          </h1>
          <p className="text-sm text-white/40 max-w-md">
            Describe the kind of horror game you're looking for in plain English.
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={onSubmit} className="w-full max-w-2xl px-4">
          <div className="relative flex items-center">
            <div className="absolute left-4 text-white/30 pointer-events-none">
              {loading ? (
                <Loader2 className="w-4.5 h-4.5 animate-spin text-white/50" />
              ) : (
                <Search className="w-4.5 h-4.5" />
              )}
            </div>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
              placeholder="e.g. co-op horror like Phasmophobia..."
              className="w-full h-12 pl-11 pr-28 bg-[#111114] border-2 border-white/15 rounded-full text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/50 transition-colors duration-200 disabled:opacity-50"
            />
            <div className="absolute right-1.5 flex items-center gap-1">
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="h-9 px-5 bg-white text-black text-xs font-bold uppercase tracking-wide rounded-full hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Search
              </button>
            </div>
          </div>
        </form>

        {/* Status / Phase */}
        {loading && displayPhase && (
          <div className="flex items-center gap-2 text-xs text-white/70 font-semibold font-mono animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            {displayPhase}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="max-w-2xl w-full px-4">
            <div className="flex items-start gap-3 border border-red-500/20 bg-red-500/5 rounded-lg px-4 py-3 text-xs text-red-400">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Quick Suggestions */}
        {!hasSearched && (
          <div className="flex flex-wrap justify-center gap-2 max-w-xl px-4">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => handleSearch(s)}
                className="px-3 py-1.5 border border-white/10 rounded-full text-[11px] text-white/45 hover:text-white hover:border-white/30 transition-colors cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Action Buttons Row */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-white/40 hover:text-white/70 transition-colors cursor-pointer"
          >
            <Key className="w-3.5 h-3.5" />
            {hasKey ? "Settings" : "Add API key"}
            {hasKey && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
          </button>
          <span className="text-white/10">|</span>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-white/40 hover:text-white/70 transition-colors cursor-pointer"
          >
            <Info className="w-3.5 h-3.5" />
            How does this work?
          </button>
        </div>
      </div>

      {/* ── Settings Panel ───────────────────────────────── */}
      {showSettings && (
        <div className="w-full max-w-2xl mx-auto px-4 mb-8">
          <div className="border border-white/10 bg-[#111114] rounded-lg p-5 flex flex-col gap-4 relative">
            <button
              onClick={() => setShowSettings(false)}
              className="absolute top-3 right-3 text-white/30 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Provider Toggle */}
            <div className="flex gap-1.5">
              {(["gemini", "openrouter", "groq"] as Provider[]).map((p) => (
                <button
                  key={p}
                  onClick={() => switchProvider(p)}
                  className={`flex-1 h-9 text-xs font-bold border rounded-lg transition-colors cursor-pointer ${
                    provider === p
                      ? "border-white/30 bg-white/5 text-white"
                      : "border-white/8 text-white/40 hover:border-white/15"
                  }`}
                >
                  {PROVIDER_CONFIG[p].label}
                </button>
              ))}
            </div>

            {/* Key Input */}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-white">API Key</span>
              <span className="text-xs text-white/40">{cfg.description} Stored locally, never sent to our servers.</span>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder={cfg.keyPlaceholder}
                  className="flex-1 h-10 px-3 bg-[#0d0d0f] border border-white/10 rounded-lg text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
                />
                {hasKey && (
                  <button
                    onClick={clearKey}
                    className="h-10 px-3 border border-white/10 rounded-lg text-xs text-white/50 hover:text-red-400 hover:border-red-500/30 transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* Model Selector */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-white/30" />
                <span className="text-xs font-bold text-white/70">Model</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-1.5">
                  {cfg.models.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setModel(m.id); setUseCustomModel(false); }}
                      className={`h-9 px-3 text-[11px] text-left border rounded-lg transition-colors cursor-pointer ${
                        !useCustomModel && model === m.id
                          ? "border-white/30 bg-white/5 text-white"
                          : "border-white/8 text-white/40 hover:border-white/15 hover:text-white/60"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={customModel}
                  onChange={(e) => { setCustomModel(e.target.value); setUseCustomModel(true); }}
                  onFocus={() => setUseCustomModel(true)}
                  placeholder="Or type a custom model name..."
                  className={`h-9 px-3 bg-[#0d0d0f] border rounded-lg text-xs text-white placeholder-white/20 focus:outline-none transition-colors ${
                    useCustomModel && customModel
                      ? "border-white/30"
                      : "border-white/8 focus:border-white/20"
                  }`}
                />
                <span className="text-[10px] text-white/25">
                  Using: {activeModel || cfg.defaultModel}
                </span>
              </div>
            </div>

            {/* Save + Links */}
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <a
                href={cfg.keyLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                {cfg.keyLinkLabel}
              </a>
              <button
                onClick={saveSettings}
                className="h-9 px-5 bg-white text-black text-xs font-bold rounded-lg hover:bg-white/90 transition-colors cursor-pointer"
              >
                Save settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Info Panel ────────────────────────────────────── */}
      {showInfo && (
        <div className="w-full max-w-2xl mx-auto px-4 mb-8">
          <div className="border border-white/10 bg-[#111114] rounded-lg p-5 flex flex-col gap-4 relative">
            <button
              onClick={() => setShowInfo(false)}
              className="absolute top-3 right-3 text-white/30 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <span className="text-sm font-bold text-white">How does this work?</span>

            <div className="flex flex-col gap-3 text-xs text-white/50 leading-relaxed">
              <p>
                This search uses Google's Gemini AI to understand what kind of horror game you're describing, then matches it against our database of tags, themes, and mechanics.
              </p>

              <div className="flex flex-col gap-2">
                <div className="flex gap-3 items-start">
                  <span className="text-white/20 font-mono shrink-0 w-4 text-right">1.</span>
                  <span>You type a description in plain English.</span>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-white/20 font-mono shrink-0 w-4 text-right">2.</span>
                  <span>Gemini translates it into structured search filters.</span>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-white/20 font-mono shrink-0 w-4 text-right">3.</span>
                  <span>We run those filters against our database and return matching games.</span>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-white/20 font-mono shrink-0 w-4 text-right">4.</span>
                  <span>The translation is cached so the same query never needs AI again.</span>
                </div>
              </div>

              <div className="border-t border-white/5 pt-3 flex flex-col gap-1.5">
                <span className="text-white/70 font-bold">Community cache</span>
                <p>
                  Every search you run gets saved. When someone else searches for the same thing, they get instant results without needing an API key. You're helping build a shared knowledge base for the community.
                </p>
              </div>

              <div className="border-t border-white/5 pt-3 flex flex-col gap-1.5">
                <span className="text-white/70 font-bold">Why do I need an API key?</span>
                <p>
                  The AI translation runs on your end using your free Google Gemini key. This keeps hoGAMEGATA free to run — we never pay for AI calls. If someone else has already searched for the same thing, you won't need a key at all.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Results ───────────────────────────────────────── */}
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 pb-16">

        {hasSearched && (
          <div className="flex items-center justify-between mb-6">
            <span className="font-mono text-[11px] uppercase tracking-widest text-white/70 font-semibold">
              {loading ? "Searching..." : `${results.length} result${results.length !== 1 ? "s" : ""}`}
            </span>
          </div>
        )}

        {results.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
            {results.map((game) => (
              <a
                key={game.id}
                href={`/game/${game.slug}`}
                className="group flex flex-col bg-[#111114] border border-white/5 hover:border-white/15 transition-all duration-200 overflow-hidden"
              >
                {/* Cover */}
                <div className="aspect-[3/4] w-full bg-[#0d0d0f] relative overflow-hidden">
                  {game.coverUrl ? (
                    <img
                      src={game.coverUrl.replace("t_thumb", "t_cover_big")}
                      alt={game.title}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/10 font-mono text-[10px] uppercase">
                      no cover
                    </div>
                  )}
                  {game.rating != null && game.rating > 0 && (() => {
                    const strokeDasharray = 2 * Math.PI * 10;
                    const strokeDashoffset = strokeDasharray - (game.rating / 100) * strokeDasharray;
                    return (
                      <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-sm p-1 rounded-full flex items-center justify-center w-8 h-8 shadow-lg">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 24 24">
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            fill="transparent"
                            stroke="rgba(255, 255, 255, 0.1)"
                            strokeWidth="2.2"
                          />
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            fill="transparent"
                            stroke="#ff2a2a"
                            strokeWidth="2.2"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute font-mono text-[9px] font-black text-white">
                          {Math.round(game.rating)}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* Info */}
                <div className="p-3 flex flex-col gap-1 flex-1">
                  <span className="text-xs font-semibold text-white leading-tight line-clamp-2 group-hover:text-red-400 transition-colors">
                    {game.title}
                  </span>
                  {game.developerNames && (
                    <span className="text-[10px] text-white/30 line-clamp-1">
                      {game.developerNames.split(", ")[0]}
                    </span>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}

        {hasSearched && !loading && results.length === 0 && (
          <div className="py-20 text-center flex flex-col items-center gap-2">
            <span className="text-sm text-white/30">No matching games found</span>
            <span className="text-xs text-white/15">Try a different description or broader terms.</span>
          </div>
        )}
      </div>
    </div>
  );
}

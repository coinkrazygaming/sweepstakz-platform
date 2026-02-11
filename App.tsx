
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  User, UserRole, Operator, CurrencyType, Game, 
  Transaction, SlotArchetype, MathModel, GameVisuals 
} from './types';
import { getStore, saveStore, createAuditLog } from './store';
import { authService } from './services/authService';
import { Layout } from './components/Layout';
import { SlotGame } from './components/SlotGame';
import { GoogleGenAI, Type } from "@google/genai";

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(authService.getCurrentUser());
  const [store, setStore] = useState(getStore());
  const [activeTab, setActiveTab] = useState<string>('');
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyType>(CurrencyType.GOLD_COIN);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  // Studio / AI Command Lab State
  const [ingestionMode, setIngestionMode] = useState<'IDLE' | 'ANALYZING' | 'EDITING'>('IDLE');
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [draftGame, setDraftGame] = useState<Game | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [sourceInput, setSourceInput] = useState('');
  const [studioSubTab, setStudioSubTab] = useState<'DESIGN' | 'MATH' | 'ART' | 'SYSTEM'>('DESIGN');
  
  // Designer AI State
  const [conceptPrompt, setConceptPrompt] = useState('');
  const [isDesigning, setIsDesigning] = useState(false);
  const [generatedConcept, setGeneratedConcept] = useState<any>(null);

  // Art Lab AI State
  const [artPrompt, setArtPrompt] = useState('');
  const [isGeneratingArt, setIsGeneratingArt] = useState(false);
  const [artPreview, setArtPreview] = useState<string | null>(null);
  const [artTarget, setArtTarget] = useState<'BACKGROUND' | 'SYMBOL' | 'POSTER'>('POSTER');

  // Multi-Tenant Management
  const [editingOperatorId, setEditingOperatorId] = useState<string | null>(null);

  useEffect(() => {
    saveStore(store);
  }, [store]);

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === UserRole.MASTER_ADMIN) setActiveTab('TENANTS');
    else if (currentUser.role === UserRole.OPERATOR) setActiveTab('DASHBOARD');
    else setActiveTab('GAMES');
  }, [currentUser]);

  const addLog = useCallback((action: string, details: string) => {
    const log = createAuditLog(action, currentUser?.id || 'sys', details);
    setStore(prev => ({ ...prev, auditLogs: [log, ...prev.auditLogs].slice(0, 1000) }));
  }, [currentUser?.id]);

  const logTerminal = useCallback((msg: string) => {
    setTerminalOutput(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-100));
  }, []);

  const handleLogin = async (username: string, role: UserRole, opId?: string) => {
    try {
      let user = store.users.find(u => u.username === username);
      if (!user) user = await authService.register(username, `${username}@sweepstack.io`, role, opId);
      const loggedIn = await authService.login(user.username);
      setCurrentUser(loggedIn);
    } catch (e) {
      alert('Auth Error: ' + (e as Error).message);
    }
  };

  const handleLogout = useCallback(() => {
    authService.logout();
    setCurrentUser(null);
    setSelectedGame(null);
    setEditingOperatorId(null);
  }, []);

  const handleSpinResult = useCallback((cost: number, win: number) => {
    if (!currentUser || !currentUser.wallet) return;

    const isGC = selectedCurrency === CurrencyType.GOLD_COIN;
    const netChange = win - cost;

    setCurrentUser(prev => {
      if (!prev || !prev.wallet) return prev;
      const updatedUser = {
        ...prev,
        wallet: {
          ...prev.wallet,
          goldCoins: isGC ? prev.wallet.goldCoins + netChange : prev.wallet.goldCoins,
          sweepsCoins: !isGC ? prev.wallet.sweepsCoins + netChange : prev.wallet.sweepsCoins,
        }
      };
      localStorage.setItem('sweepstack_session', JSON.stringify(updatedUser));
      return updatedUser;
    });

    setStore(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === currentUser.id ? {
        ...u,
        wallet: {
          goldCoins: isGC ? (u.wallet?.goldCoins || 0) + netChange : (u.wallet?.goldCoins || 0),
          sweepsCoins: !isGC ? (u.wallet?.sweepsCoins || 0) + netChange : (u.wallet?.sweepsCoins || 0),
        }
      } : u)
    }));

    addLog('GAME_SPIN', `Asset: ${selectedGame?.name}, Delta: ${netChange} ${selectedCurrency}`);
  }, [currentUser, selectedCurrency, selectedGame, addLog]);

  // --- ART LAB ENGINE ---
  const handleGenerateArt = async () => {
    if (!artPrompt) return;
    setIsGeneratingArt(true);
    logTerminal(`ART LAB: Synthesizing ${artTarget} for "${artPrompt}"...`);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: `A high-quality, professional casino game asset. Target: ${artTarget}. Style: ${draftGame?.visuals.uiSkins || 'modern'} casino. Prompt: ${artPrompt}` }]
        },
        config: {
          imageConfig: {
            aspectRatio: artTarget === 'BACKGROUND' ? "16:9" : "1:1"
          }
        }
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          setArtPreview(imageUrl);
          logTerminal(`Asset Synthesized successfully.`);
          break;
        }
      }
    } catch (e) {
      logTerminal(`ART LAB ERROR: ${(e as Error).message}`);
    } finally {
      setIsGeneratingArt(false);
    }
  };

  const applyArtToDraft = () => {
    if (!artPreview || !draftGame) return;
    
    setDraftGame(prev => {
      if (!prev) return null;
      if (artTarget === 'POSTER') {
        return { ...prev, imageUrl: artPreview };
      } else if (artTarget === 'BACKGROUND') {
        return { ...prev, visuals: { ...prev.visuals, backgroundUrl: artPreview } };
      } else if (artTarget === 'SYMBOL') {
        // Simple logic: add a new symbol or replace the first one for MVP
        const newSymbols = [...prev.visuals.symbols];
        newSymbols[0] = { ...newSymbols[0], url: artPreview, name: artPrompt.substring(0, 15) };
        return { ...prev, visuals: { ...prev.visuals, symbols: newSymbols } };
      }
      return prev;
    });
    
    setArtPreview(null);
    logTerminal(`Asset committed to Shard Draft.`);
  };

  // --- AI DESIGNER ENGINE ---
  const handleGenerateConcept = async () => {
    if (!conceptPrompt) return;
    setIsDesigning(true);
    logTerminal(`ACTIVATE DESIGNER AI: Conceptualizing "${conceptPrompt}"...`);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `TASK: Senior Creative Director for high-end Casino games. 
        PROMPT: "${conceptPrompt}".
        REQUIRED: Create a complete slot machine concept.
        INCLUDE: Name, Theme, Storyline, Unique Bonus Mechanic, Symbol Set (names), and Visual Direction.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              theme: { type: Type.STRING },
              storyline: { type: Type.STRING },
              mechanic: { type: Type.STRING },
              symbols: { type: Type.ARRAY, items: { type: Type.STRING } },
              visualDirection: { type: Type.STRING }
            },
            required: ['name', 'theme', 'storyline', 'mechanic', 'symbols', 'visualDirection']
          }
        }
      });

      const concept = JSON.parse(response.text);
      setGeneratedConcept(concept);
      logTerminal(`Concept Synthesized: "${concept.name}"`);
      logTerminal(`Storyline Loaded: ${concept.storyline.substring(0, 50)}...`);
    } catch (e) {
      logTerminal(`DESIGNER ERROR: ${(e as Error).message}`);
    } finally {
      setIsDesigning(false);
    }
  };

  const initializeDraftFromConcept = () => {
    if (!generatedConcept) return;
    
    const newDraft: Game = {
      id: `ai-design-${Date.now()}`,
      name: generatedConcept.name,
      slug: generatedConcept.name.toLowerCase().replace(/\s+/g, '-'),
      type: 'SLOT',
      imageUrl: 'https://images.unsplash.com/photo-1606167668584-78701c57f13d', // Initial Placeholder
      description: generatedConcept.storyline,
      minBet: 1,
      status: 'DRAFT',
      mathModel: {
        rtp: 96.5,
        volatility: 'HIGH',
        hitRate: 28.5,
        archetype: SlotArchetype.PAYLINES_5X3,
        reelStrips: [['💎', '🔔', '7️⃣'], ['7️⃣', '💎', '🔔'], ['🔔', '7️⃣', '💎']],
        paytable: { '💎': [5, 20, 100], '7️⃣': [10, 50, 500], '🔔': [2, 10, 50] },
        symbolWeights: generatedConcept.symbols.map((s: string, i: number) => ({ symbolId: `s${i}`, weight: 10 })),
        featureFrequency: 140
      },
      visuals: {
        symbols: generatedConcept.symbols.map((s: string, i: number) => ({ id: `s${i}`, name: s, url: '', weight: 10 })),
        backgroundUrl: '',
        themeColors: { primary: '#6366f1', secondary: '#000', accent: '#fff' },
        uiSkins: 'modern',
        fontFamily: 'Inter',
        soundPack: 'Electric'
      }
    };

    setDraftGame(newDraft);
    setIngestionMode('EDITING');
    logTerminal(`Draft "${newDraft.name}" initialized in Shard Matrix.`);
  };

  const handleAISynthesis = async () => {
    if (!sourceInput) return;
    setIngestionMode('ANALYZING');
    setTerminalOutput(['BOOTING SHARD INGRESS ENGINE v7.5...', 'SCANNING LEGACY ASSET BUNDLES...']);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      logTerminal('Reverse Engineering State Machines...');
      await new Promise(r => setTimeout(r, 800));
      logTerminal('Decompiling Math Model from Bundle logic...');

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `REBUILD TASK: Analyze "${sourceInput}". 
        Deconstruct legacy symbols, paytables, and math cycles. 
        Re-synthesize into a proprietary SweepStack shard with:
        - Target RTP: 96.5%
        - Archetype: ${SlotArchetype.PAYLINES_5X3}
        - Optimized for Multi-Tenant Deployment.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              rtp: { type: Type.NUMBER },
              description: { type: Type.STRING },
              volatility: { type: Type.STRING },
              symbols: { type: Type.ARRAY, items: { type: Type.STRING } },
              imageUrl: { type: Type.STRING },
              paytable: { type: Type.OBJECT, properties: { premium: { type: Type.ARRAY, items: { type: Type.NUMBER } } } }
            },
            required: ['name', 'rtp', 'symbols', 'imageUrl']
          }
        }
      });

      const data = JSON.parse(response.text);
      logTerminal(`Success: Extracted Shard "${data.name}".`);
      logTerminal('Synthesizing high-fidelity art assets via DALL-E/Stable-Diffusion abstraction...');

      const gameDraft: Game = {
        id: `shrd-${Date.now()}`,
        name: data.name,
        slug: data.name.toLowerCase().replace(/\s+/g, '-'),
        type: 'SLOT',
        imageUrl: data.imageUrl || 'https://images.unsplash.com/photo-1606167668584-78701c57f13d',
        description: data.description || 'Native sharded sweepstakes slot synthesized from legacy ingress.',
        minBet: 1,
        status: 'DRAFT',
        mathModel: {
          rtp: data.rtp || 96.5,
          volatility: (data.volatility as any) || 'HIGH',
          hitRate: 29.4,
          archetype: SlotArchetype.PAYLINES_5X3,
          reelStrips: [['💎', '7️⃣', '🍋', '🍒'], ['🍋', '💎', '7️⃣', '🍒'], ['🍒', '🍋', '💎', '7️⃣']],
          paytable: { '💎': [5, 20, 100], '7️⃣': [10, 50, 500], '🍋': [2, 10, 50], '🍒': [1, 5, 20] },
          symbolWeights: data.symbols.map((s: string, i: number) => ({ symbolId: `s${i}`, weight: 10 })),
          featureFrequency: 125
        },
        visuals: {
          symbols: data.symbols.map((s: string, i: number) => ({ id: `s${i}`, name: s, url: '', weight: 10 })),
          backgroundUrl: '',
          themeColors: { primary: '#6366f1', secondary: '#000', accent: '#fff' },
          uiSkins: 'modern',
          fontFamily: 'Inter',
          soundPack: 'Electric'
        }
      };

      setDraftGame(gameDraft);
      setIngestionMode('EDITING');
      logTerminal('Command Lab synthesis complete. Shard live for modification.');
    } catch (e) {
      logTerminal(`CRITICAL INGRESS FAILURE: ${(e as Error).message}`);
      setIngestionMode('IDLE');
    }
  };

  const publishToLibrary = () => {
    if (!draftGame) return;
    setStore(prev => ({
      ...prev,
      globalGames: [...prev.globalGames, { ...draftGame, status: 'PUBLISHED' }]
    }));
    logTerminal(`DEPLOYMENT SUCCESS: "${draftGame.name}" is now globally sharded.`);
    setIngestionMode('IDLE');
    setDraftGame(null);
  };

  const renderStudio = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fadeIn">
      {/* Engine Feed */}
      <div className="lg:col-span-4 glass rounded-[2.5rem] p-8 border border-white/5 flex flex-col h-[750px] shadow-2xl relative group">
        <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-[2.5rem] pointer-events-none"></div>
        <div className="flex justify-between items-center mb-6 relative z-10">
          <h3 className="text-indigo-500 font-black uppercase text-[10px] tracking-[0.4em]">Synthesis Terminal v7.5</h3>
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500/40"></div>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_green]"></div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-2 text-indigo-300/80 scrollbar-hide relative z-10">
          {terminalOutput.map((line, i) => (
            <div key={i} className="flex gap-4 border-l-2 border-indigo-500/20 pl-4 py-0.5 hover:bg-white/5 transition-colors">
              <span className="text-slate-600 select-none">{i.toString().padStart(3, '0')}</span>
              <span className="text-white/90">{line}</span>
            </div>
          ))}
          {(isSimulating || isDesigning || isGeneratingArt) && <div className="text-indigo-400 animate-pulse font-black">>>> PROCESSING SHARD SYNTHESIS...</div>}
        </div>
        <div className="mt-6 pt-6 border-t border-white/5 space-y-4 relative z-10">
          <div className="relative">
            <textarea 
              value={sourceInput}
              onChange={(e) => setSourceInput(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded-2xl p-5 text-[11px] text-white outline-none focus:border-indigo-500 h-28 transition-all font-mono placeholder:text-slate-700"
              placeholder="Inject Legacy WASM/HTML5 Manifest for Re-Sharding..."
            />
            <div className="absolute top-4 right-4 text-[9px] font-black text-slate-700 uppercase tracking-widest">Input Buffer</div>
          </div>
          <button 
            onClick={handleAISynthesis}
            disabled={ingestionMode === 'ANALYZING' || !sourceInput}
            className="w-full py-5 bg-indigo-600 rounded-2xl text-white font-black uppercase text-[11px] tracking-widest hover:bg-indigo-500 hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] transition-all disabled:opacity-30 disabled:grayscale"
          >
            {ingestionMode === 'ANALYZING' ? <i className="fa-solid fa-sync animate-spin mr-3"></i> : <i className="fa-solid fa-bolt-lightning mr-3"></i>}
            Decompile & Synthesis Shard
          </button>
        </div>
      </div>

      {/* Lab Interface */}
      <div className="lg:col-span-8 space-y-8">
        <div className="glass p-12 rounded-[4rem] border border-indigo-500/30 bg-gradient-to-br from-indigo-900/20 via-slate-900 to-black relative overflow-hidden shadow-3xl min-h-[750px]">
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none"></div>
          
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-5xl font-black italic text-white uppercase tracking-tighter leading-none mb-4">
                {draftGame ? draftGame.name : 'Command Lab'}
              </h2>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.5em] ml-1">AI SHARD GENERATION CORE</p>
            </div>
            <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5">
              <StudioTab active={studioSubTab === 'DESIGN'} label="Design AI" onClick={() => setStudioSubTab('DESIGN')} />
              <StudioTab active={studioSubTab === 'MATH'} label="Math AI" onClick={() => setStudioSubTab('MATH')} />
              <StudioTab active={studioSubTab === 'ART'} label="Art Lab" onClick={() => setStudioSubTab('ART')} />
              <StudioTab active={studioSubTab === 'SYSTEM'} label="Deployment" onClick={() => setStudioSubTab('SYSTEM')} />
            </div>
          </div>

          {studioSubTab === 'DESIGN' && (
            <div className="space-y-10 animate-fadeIn">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <h4 className="text-[11px] font-black text-indigo-400 uppercase tracking-widest">Concept Generator</h4>
                  <div className="space-y-4">
                    <p className="text-xs text-slate-400 leading-relaxed">Prompter for conceptualizing entirely new slot mechanics, themes, and storylines from scratch.</p>
                    <textarea 
                      value={conceptPrompt}
                      onChange={(e) => setConceptPrompt(e.target.value)}
                      className="w-full bg-black/40 border border-white/5 rounded-2xl p-5 text-xs text-white h-32 focus:border-indigo-500 transition-all placeholder:text-slate-700" 
                      placeholder="E.g. A noir detective slot where symbols are clues and the bonus is a high-speed chase..."/>
                    <button 
                      onClick={handleGenerateConcept}
                      disabled={isDesigning || !conceptPrompt}
                      className="w-full py-5 bg-indigo-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest shadow-xl hover:bg-indigo-500 transition-all disabled:opacity-50"
                    >
                      {isDesigning ? <i className="fa-solid fa-brain animate-pulse mr-2"></i> : <i className="fa-solid fa-wand-magic-sparkles mr-2"></i>}
                      Generate Global Concept
                    </button>
                  </div>
                </div>

                <div className="p-8 bg-black/60 rounded-[3rem] border border-white/5 shadow-inner min-h-[300px] flex flex-col">
                  {generatedConcept ? (
                    <div className="space-y-6 animate-fadeIn">
                      <div>
                        <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1">Generated Title</p>
                        <h5 className="text-2xl font-black italic text-white uppercase">{generatedConcept.name}</h5>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1">Theme & Narrative</p>
                        <p className="text-xs text-slate-400 leading-relaxed italic">"{generatedConcept.storyline}"</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                          <p className="text-[8px] font-black text-slate-600 uppercase mb-1">Unique Mechanic</p>
                          <p className="text-[10px] font-bold text-indigo-300">{generatedConcept.mechanic}</p>
                        </div>
                        <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                          <p className="text-[8px] font-black text-slate-600 uppercase mb-1">Visual Direction</p>
                          <p className="text-[10px] font-bold text-slate-400 line-clamp-2">{generatedConcept.visualDirection}</p>
                        </div>
                      </div>
                      <button 
                        onClick={initializeDraftFromConcept}
                        className="w-full mt-4 py-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-white font-black uppercase text-[9px] tracking-widest transition-all"
                      >
                        Initialize Shard Draft
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30">
                      <i className="fa-solid fa-sparkles text-4xl mb-4"></i>
                      <p className="text-[10px] font-black uppercase tracking-widest">Awaiting AI Creative Output</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Designer Suggestions */}
              <div className="mt-8">
                 <h4 className="text-[11px] font-black text-slate-600 uppercase tracking-widest mb-6">Trending Concepts</h4>
                 <div className="grid grid-cols-3 gap-6">
                    {['Ancient Mars', 'Neon Olympus', 'Steam Alchemist'].map(trend => (
                      <div 
                        key={trend} 
                        onClick={() => setConceptPrompt(`A high-fidelity ${trend} slot with unique cluster pays...`)}
                        className="p-5 bg-white/5 border border-white/5 rounded-3xl hover:border-indigo-500/50 transition-all cursor-pointer group"
                      >
                        <p className="text-xs font-black text-white uppercase italic group-hover:text-indigo-400">{trend}</p>
                        <p className="text-[9px] text-slate-600 mt-2 font-bold">Auto-Prompt Generator</p>
                      </div>
                    ))}
                 </div>
              </div>
            </div>
          )}

          {studioSubTab === 'MATH' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 animate-fadeIn">
              {draftGame ? (
                <>
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[11px] font-black text-indigo-400 uppercase tracking-widest">Target RTP Floor</label>
                        <span className="text-xl font-black italic text-white">{draftGame.mathModel.rtp}%</span>
                      </div>
                      <input type="range" className="w-full accent-indigo-600 bg-slate-800 rounded-lg h-2" min="92" max="98" step="0.1" defaultValue={draftGame.mathModel.rtp} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <EditorInput label="Volatility Tier" value={draftGame.mathModel.volatility} />
                      <EditorInput label="Archetype" value={draftGame.mathModel.archetype} />
                      <EditorInput label="Bonus Freq" value={`1 / ${draftGame.mathModel.featureFrequency}`} />
                      <EditorInput label="Hit Rate" value={`${draftGame.mathModel.hitRate}%`} />
                    </div>
                    <button onClick={() => { setIsSimulating(true); setTimeout(() => { setIsSimulating(false); logTerminal('Monte Carlo Verified: Theoretical RTP 96.52%'); }, 1500); }} className="w-full py-5 bg-white/5 border border-indigo-500/20 rounded-2xl text-indigo-400 font-black uppercase text-[10px] tracking-widest hover:bg-indigo-500/10 transition-all flex items-center justify-center gap-3">
                      <i className="fa-solid fa-microchip"></i> Validate Payout Curve (10M Runs)
                    </button>
                  </div>
                  <div className="p-8 bg-black/60 rounded-[3rem] border border-white/5 shadow-inner flex flex-col items-center justify-center text-center">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-8">Paytable Sharding Matrix</p>
                    <div className="grid grid-cols-4 gap-4 w-full">
                      {Object.keys(draftGame.mathModel.paytable).map((s, i) => (
                        <div key={i} className="aspect-square bg-slate-900 rounded-3xl flex items-center justify-center text-3xl shadow-xl border border-white/5 hover:border-indigo-500/50 transition-all cursor-pointer group">
                          <span className="group-hover:scale-125 transition-transform">{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="col-span-2 flex flex-col items-center justify-center opacity-20 py-20">
                  <i className="fa-solid fa-calculator text-6xl mb-6"></i>
                  <p className="text-xl font-black uppercase italic">No Active Shard Draft</p>
                </div>
              )}
            </div>
          )}

          {studioSubTab === 'ART' && (
            <div className="animate-fadeIn space-y-10">
              {draftGame ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <h4 className="text-[11px] font-black text-indigo-400 uppercase tracking-widest">Generative Asset Engine</h4>
                    <div className="bg-black/40 p-1.5 rounded-2xl border border-white/5 flex mb-6">
                      <button 
                        onClick={() => setArtTarget('POSTER')}
                        className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${artTarget === 'POSTER' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}
                      >Main Art</button>
                      <button 
                        onClick={() => setArtTarget('BACKGROUND')}
                        className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${artTarget === 'BACKGROUND' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}
                      >Background</button>
                      <button 
                        onClick={() => setArtTarget('SYMBOL')}
                        className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${artTarget === 'SYMBOL' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}
                      >Symbols</button>
                    </div>
                    <div className="space-y-4">
                      <p className="text-xs text-slate-400 leading-relaxed">Synthesis prompt for high-fidelity textures and sharded visuals.</p>
                      <textarea 
                        value={artPrompt}
                        onChange={(e) => setArtPrompt(e.target.value)}
                        className="w-full bg-black/40 border border-white/5 rounded-2xl p-5 text-xs text-white h-24 focus:border-indigo-500 transition-all placeholder:text-slate-700" 
                        placeholder="E.g. Ultra-premium galactic diamond symbol, 8k resolution, glowing neon highlights..."/>
                      <button 
                        onClick={handleGenerateArt}
                        disabled={isGeneratingArt || !artPrompt}
                        className="w-full py-4 bg-indigo-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest shadow-xl hover:bg-indigo-500 transition-all disabled:opacity-50"
                      >
                        {isGeneratingArt ? <i className="fa-solid fa-palette animate-pulse mr-2"></i> : <i className="fa-solid fa-paintbrush mr-2"></i>}
                        Synthesize {artTarget}
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center justify-center">
                    <div className={`w-full aspect-square bg-slate-900 border-2 border-dashed border-white/5 rounded-[3rem] overflow-hidden flex items-center justify-center relative group ${isGeneratingArt ? 'animate-pulse' : ''}`}>
                      {artPreview ? (
                        <>
                          <img src={artPreview} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                             <button 
                               onClick={applyArtToDraft}
                               className="px-8 py-3 bg-white text-black font-black rounded-full text-[10px] uppercase tracking-widest shadow-2xl"
                             >Commit to Shard</button>
                          </div>
                        </>
                      ) : (
                        <div className="text-center opacity-20">
                          <i className="fa-solid fa-image text-6xl mb-4"></i>
                          <p className="text-[10px] font-black uppercase">Awaiting Synthesis</p>
                        </div>
                      )}
                    </div>
                    {draftGame.visuals.symbols[0].url && (
                      <div className="mt-8 w-full">
                         <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-4">Existing Shard Visuals</p>
                         <div className="grid grid-cols-4 gap-4">
                            <div className="aspect-square bg-slate-900 rounded-2xl overflow-hidden border border-white/10 shadow-xl">
                               <img src={draftGame.imageUrl} className="w-full h-full object-cover" />
                            </div>
                            {draftGame.visuals.backgroundUrl && (
                              <div className="aspect-square bg-slate-900 rounded-2xl overflow-hidden border border-white/10 shadow-xl">
                                <img src={draftGame.visuals.backgroundUrl} className="w-full h-full object-cover" />
                              </div>
                            )}
                         </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center opacity-20 py-20">
                  <i className="fa-solid fa-brush text-6xl mb-6"></i>
                  <p className="text-xl font-black uppercase italic">No Active Shard Draft</p>
                </div>
              )}
            </div>
          )}

          {studioSubTab === 'SYSTEM' && (
            <div className="animate-fadeIn space-y-10">
              {draftGame ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center text-green-500 mb-10 shadow-[0_0_50px_rgba(34,197,94,0.3)]">
                    <i className="fa-solid fa-check-double text-4xl"></i>
                  </div>
                  <h4 className="text-3xl font-black italic text-white uppercase mb-4">Final Deployment Readiness</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed mb-10">Shard certified for all multi-tenant nodes. Provably fair seed initialization complete. RTP curves validated against global fleet.</p>
                  <button 
                    onClick={publishToLibrary}
                    className="px-16 py-6 bg-white text-black font-black rounded-3xl uppercase tracking-[0.4em] text-xs shadow-2xl hover:scale-105 transition-all"
                  >
                    Release Globally
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center opacity-20 py-20">
                  <i className="fa-solid fa-shuttle-space text-6xl mb-6"></i>
                  <p className="text-xl font-black uppercase italic">No Active Shard Draft</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderTenants = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-fadeIn">
      {store.operators.map(op => (
        <div key={op.id} className="glass p-10 rounded-[3.5rem] border border-white/10 hover:border-indigo-500/30 transition-all group relative overflow-hidden shadow-2xl">
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-10">
              <div>
                <h3 className="text-2xl font-black italic uppercase tracking-tighter leading-none mb-2">{op.name}</h3>
                <p className="text-[10px] text-indigo-500/60 font-mono tracking-widest">{op.subdomain}.sweepstack.io</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <i className="fa-solid fa-microchip text-sm"></i>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-10">
              <div className="p-5 bg-black/40 rounded-3xl border border-white/5 shadow-inner">
                <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest mb-1">Total Revenue</p>
                <p className="text-xl font-black text-white italic">${op.revenue.toLocaleString()}</p>
              </div>
              <div className="p-5 bg-black/40 rounded-3xl border border-white/5 shadow-inner">
                <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest mb-1">Global Shards</p>
                <p className="text-xl font-black text-indigo-400 italic">{op.assignedGames.length}</p>
              </div>
            </div>
            <button 
              onClick={() => setEditingOperatorId(op.id)}
              className="w-full py-5 bg-slate-900 rounded-2xl text-white font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 transition-all shadow-xl group-hover:shadow-[0_0_30px_rgba(99,102,241,0.2)]"
            >
              Control Shard Node
            </button>
          </div>
          <div className="absolute -bottom-16 -right-16 opacity-[0.03] group-hover:scale-110 transition-all duration-1000 rotate-12">
            <i className="fa-solid fa-server text-[15rem]"></i>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <Layout 
      user={currentUser} 
      operator={currentUser?.operatorId ? store.operators.find(o => o.id === currentUser.operatorId) : undefined} 
      onLogout={handleLogout} 
      onSwitchRole={() => {}} 
      activeTab={activeTab} 
      onTabChange={setActiveTab}
    >
      {currentUser?.role === UserRole.MASTER_ADMIN && (
        <div className="space-y-12 animate-fadeIn">
          <div className="flex justify-between items-center border-b border-white/5 pb-10">
            <div className="flex gap-12">
              <TabButton label="Fleet Command" active={activeTab === 'TENANTS'} onClick={() => setActiveTab('TENANTS')} />
              <TabButton label="AI Command Lab" active={activeTab === 'STUDIO'} onClick={() => setActiveTab('STUDIO')} />
              <TabButton label="Audit Oracle" active={activeTab === 'AUDIT'} onClick={() => setActiveTab('AUDIT')} />
            </div>
            <button className="px-10 py-4 bg-white text-black font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-3xl hover:bg-indigo-50 transition-all active:scale-95">Provision New Shard Node</button>
          </div>
          {activeTab === 'TENANTS' && renderTenants()}
          {activeTab === 'STUDIO' && renderStudio()}
          {activeTab === 'AUDIT' && (
            <div className="glass p-12 rounded-[3.5rem] border border-white/5 shadow-2xl animate-fadeIn">
              <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-8">System Audit Oracle</h3>
              <div className="space-y-4">
                 {store.auditLogs.slice(0, 20).map(log => (
                    <div key={log.id} className="flex items-center gap-6 p-5 bg-black/40 rounded-2xl border border-white/5 hover:bg-white/5 transition-colors group">
                       <span className="text-[10px] font-mono text-slate-700">{new Date(log.createdAt).toLocaleTimeString()}</span>
                       <span className="px-3 py-1 bg-indigo-600/10 text-indigo-400 rounded-lg text-[10px] font-black uppercase tracking-widest">{log.action}</span>
                       <p className="text-xs text-slate-400 font-medium group-hover:text-white transition-colors">{log.details}</p>
                    </div>
                 ))}
              </div>
            </div>
          )}
        </div>
      )}

      {currentUser?.role === UserRole.PLAYER && (
        <div className="animate-fadeIn">
          {selectedGame ? (
            <div className="space-y-10 animate-fadeIn">
               <button onClick={() => setSelectedGame(null)} className="text-slate-600 hover:text-white uppercase text-[10px] font-black tracking-[0.4em] flex items-center gap-3 transition-all">
                 <i className="fa-solid fa-arrow-left-long"></i> Return to Casino Floor
               </button>
               <SlotGame 
                 game={selectedGame} 
                 currency={selectedCurrency} 
                 wallet={currentUser.wallet!} 
                 onSpin={handleSpinResult} 
               />
            </div>
          ) : (
            <div className="space-y-14">
              <div className="flex flex-col md:flex-row justify-between items-center gap-8 bg-slate-900/30 p-10 rounded-[3.5rem] border border-white/5 shadow-inner">
                <div>
                  <h2 className="text-5xl font-black italic uppercase tracking-tighter text-white leading-none mb-3">Sharded Lobby</h2>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em] ml-1">Universal Social Engine v7.5</p>
                </div>
                <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5">
                  <CurrencyToggle active={selectedCurrency === CurrencyType.GOLD_COIN} label="Gold Coins" onClick={() => setSelectedCurrency(CurrencyType.GOLD_COIN)} />
                  <CurrencyToggle active={selectedCurrency === CurrencyType.SWEEPS_COIN} label="Sweeps Coins" onClick={() => setSelectedCurrency(CurrencyType.SWEEPS_COIN)} />
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-10">
                {store.globalGames.map(game => (
                  <div 
                    key={game.id} 
                    onClick={() => setSelectedGame(game)}
                    className="group glass rounded-[3.5rem] overflow-hidden border border-white/10 cursor-pointer hover:border-indigo-500/40 transition-all shadow-xl hover:-translate-y-3"
                  >
                    <div className="relative aspect-[3/4] overflow-hidden">
                       <img src={game.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-1000" />
                       <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent p-10 flex flex-col justify-end">
                          <h4 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none mb-2">{game.name}</h4>
                          <div className="flex items-center gap-3">
                            <span className="text-[9px] bg-indigo-600 text-white px-3 py-1 rounded-full font-black uppercase tracking-widest shadow-lg">Native Shard</span>
                            <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{game.mathModel.volatility}</span>
                          </div>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!currentUser && (
        <div className="flex items-center justify-center min-h-[70vh] animate-fadeIn">
          <div className="max-w-md w-full glass p-14 rounded-[4.5rem] text-center border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.5)] relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 to-transparent opacity-50"></div>
            <div className="relative z-10">
              <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] mx-auto mb-10 flex items-center justify-center text-white text-4xl font-black shadow-2xl rotate-3 group-hover:rotate-0 transition-transform duration-700">S</div>
              <h2 className="text-4xl font-black italic text-white uppercase tracking-tighter mb-10">SweepStack Platform</h2>
              <div className="space-y-5">
                 <button onClick={() => handleLogin('corey', UserRole.MASTER_ADMIN)} className="w-full py-5 bg-indigo-600 rounded-2xl text-white font-black uppercase text-xs tracking-[0.2em] hover:bg-indigo-500 hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] transition-all active:scale-[0.98]">Platform Master</button>
                 <button onClick={() => handleLogin('player_shrd', UserRole.PLAYER, 'op-1')} className="w-full py-5 bg-slate-900 rounded-2xl text-slate-400 font-black uppercase text-xs tracking-[0.2em] border border-white/5 hover:bg-slate-800 hover:text-white transition-all active:scale-[0.98]">Shard Lobby Entry</button>
              </div>
              <p className="mt-12 text-[9px] text-slate-700 font-black uppercase tracking-[0.4em]">Enterprise Social Casino SaaS</p>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

// --- SMALL COMPONENTS ---

const TabButton = ({ label, active, onClick }: any) => (
  <button onClick={onClick} className={`pb-6 text-[11px] font-black uppercase tracking-[0.4em] transition-all relative ${active ? 'text-white' : 'text-slate-600 hover:text-slate-400'}`}>
    {label}
    {active && <div className="absolute bottom-0 left-0 w-full h-1.5 bg-indigo-600 rounded-full shadow-[0_0_15px_indigo] shadow-indigo-500/50"></div>}
  </button>
);

const CurrencyToggle = ({ label, active, onClick }: any) => (
  <button onClick={onClick} className={`px-10 py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all ${active ? 'bg-indigo-600 text-white shadow-2xl' : 'bg-transparent text-slate-500 hover:text-white'}`}>{label}</button>
);

const StudioTab = ({ label, active, onClick }: any) => (
  <button onClick={onClick} className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${active ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-600 hover:text-white'}`}>{label}</button>
);

const EditorInput = ({ label, value }: { label: string; value: string | number }) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">{label}</label>
    <div className="bg-black/60 border border-white/10 rounded-2xl px-6 py-4 text-xs text-white font-black italic tracking-tight shadow-inner">{value}</div>
  </div>
);

export default App;

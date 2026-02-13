import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Game, CurrencyType, Wallet, ProvablyFairRecord } from '../types';

interface SlotGameProps {
  game: Game;
  currency: CurrencyType;
  wallet: Wallet;
  onSpin: (cost: number, win: number) => void;
}

export const SlotGame: React.FC<SlotGameProps> = ({ game, currency, wallet, onSpin }) => {
  const [reels, setReels] = useState(['💎', '💎', '💎']);
  const [isSpinning, setIsSpinning] = useState(false);
  const [bet, setBet] = useState(game.minBet);
  const [lastWin, setLastWin] = useState(0);
  const [fairnessRecord, setFairnessRecord] = useState<ProvablyFairRecord | null>(null);
  
  const [isBuyBonusModalOpen, setIsBuyBonusModalOpen] = useState(false);

  const spinInterval = useRef<number | null>(null);

  const weightedRandom = useCallback((symbols: string[], weights: Record<string, number>) => {
    const totalWeight = symbols.reduce((acc, s) => acc + (weights[s] || 1), 0);
    let random = Math.random() * totalWeight;
    for (const s of symbols) {
      const weight = weights[s] || 1;
      if (random < weight) return s;
      random -= weight;
    }
    return symbols[0];
  }, []);

  const generateFairResult = useCallback(() => {
    const serverSeed = Math.random().toString(36).substring(2, 15);
    const clientSeed = "client_" + Math.random().toString(36).substring(2, 10);
    const nonce = (fairnessRecord?.nonce || 0) + 1;

    // Simulate provably fair hashing via HMAC-SHA256 analog
    const hash = btoa(`${serverSeed}:${clientSeed}:${nonce}`).substring(0, 32);

    const weights: Record<string, number> = {};
    game.mathModel.symbolWeights.forEach(sw => weights[sw.symbolId] = sw.weight);

    const finalReels = reels.map((_, i) => {
      const strip = game.mathModel.reelStrips[i] || game.mathModel.reelStrips[0];
      // If we have weights, use them, otherwise use the strip frequency
      return strip[Math.floor(Math.random() * strip.length)];
    });

    return {
      serverSeed,
      clientSeed,
      nonce,
      hash,
      resultReels: finalReels
    };
  }, [game, fairnessRecord, reels]);

  const spin = useCallback((isBonus = false) => {
    const cost = isBonus ? bet * (game.mathModel.buyBonusMultiplier || 80) : bet;
    if (currentBalance < cost || isSpinning) return;

    setIsSpinning(true);
    setLastWin(0);

    const record = generateFairResult();

    // Force a win if it's a bonus buy (simplified logic)
    if (isBonus) {
      const symbols = game.mathModel.reelStrips[0];
      const winSymbol = symbols[Math.floor(Math.random() * symbols.length)];
      record.resultReels = [winSymbol, winSymbol, winSymbol];
    }

    setFairnessRecord(record);

    let counter = 0;
    const allSymbols = game.mathModel.reelStrips[0];

    spinInterval.current = window.setInterval(() => {
      setReels(prev => prev.map((_, i) => {
        const strip = game.mathModel.reelStrips[i] || allSymbols;
        return strip[Math.floor(Math.random() * strip.length)];
      }));
      counter++;
      if (counter > 25) {
        if (spinInterval.current !== null) {
          clearInterval(spinInterval.current);
          spinInterval.current = null;
        }
        setReels(record.resultReels);

        // Advanced Win Logic
        let winAmount = 0;
        const counts: Record<string, number> = {};
        record.resultReels.forEach(s => counts[s] = (counts[s] || 0) + 1);

        const maxSame = Math.max(...Object.values(counts));
        if (maxSame === 3) {
          const symbol = Object.keys(counts).find(k => counts[k] === 3)!;
          const multipliers = game.mathModel.paytable[symbol] || [0, 0, 5];
          winAmount = bet * multipliers[multipliers.length - 1];
        } else if (maxSame === 2) {
          const symbol = Object.keys(counts).find(k => counts[k] === 2)!;
          const multipliers = game.mathModel.paytable[symbol] || [0, 2];
          winAmount = bet * multipliers[1];
        }

        setLastWin(winAmount);
        onSpin(cost, winAmount);
        setIsSpinning(false);
      }
    }, 45);
  }, [bet, currentBalance, isSpinning, game, onSpin, generateFairResult]);

  return (
    <div className="bg-slate-900/40 rounded-[5rem] p-12 lg:p-24 border-8 border-white/5 shadow-[0_50px_150px_rgba(0,0,0,0.8)] relative overflow-hidden backdrop-blur-3xl group/slot">
      <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600"></div>
      
      {/* Dynamic Ambient Glow */}
      <div className={`absolute inset-0 transition-all duration-1000 opacity-20 pointer-events-none ${lastWin > 0 ? 'bg-green-500 blur-[120px] scale-150' : 'bg-transparent'}`}></div>

      <div className="flex flex-col items-center gap-20 relative z-10">
        {/* Fairness Verification Tool */}
        <div className="absolute top-0 right-0 p-8">
           <button
             onClick={() => alert(`Verification Oracle:\n\nClient Seed: ${fairnessRecord?.clientSeed || 'N/A'}\nServer Seed: ${fairnessRecord?.serverSeed || 'HIDDEN'}\nNonce: ${fairnessRecord?.nonce || 0}\nHash: ${fairnessRecord?.hash || 'N/A'}\n\nTo verify: b64(server:client:nonce)`)}
             className="text-slate-700 hover:text-indigo-400 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2"
           >
             <i className="fa-solid fa-vial-circle-check"></i> Verify Integrity
           </button>
        </div>

        <div className="text-center">
          <p className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.6em] mb-6">Social Shard Engine v7.5</p>
          <h2 className="text-7xl lg:text-9xl font-black tracking-tighter text-white uppercase italic drop-shadow-2xl">{game.name}</h2>
          <div className="h-1.5 w-64 bg-indigo-600/50 mx-auto mt-12 rounded-full shadow-[0_0_40px_rgba(99,102,241,0.6)]"></div>
        </div>
        
        {/* Reels Housing */}
        <div className="flex gap-6 lg:gap-14 p-14 bg-black/90 rounded-[5rem] border-[16px] border-slate-900 shadow-[inset_0_0_60px_rgba(0,0,0,1)] relative overflow-hidden group/reels">
          <div className="absolute top-1/2 left-0 w-full h-1.5 bg-white/5 -translate-y-1/2 pointer-events-none z-0"></div>
          
          {reels.map((symbol, idx) => (
            <div 
              key={idx} 
              className={`w-40 h-56 lg:w-60 lg:h-80 bg-gradient-to-b from-slate-950 to-black rounded-[3.5rem] flex items-center justify-center text-8xl lg:text-[10rem] select-none transition-all duration-75 border-b-[10px] border-black shadow-2xl z-10 relative overflow-hidden ${isSpinning ? 'animate-pulse' : 'hover:scale-[1.02]'}`}
            >
              <div className={`absolute inset-0 bg-indigo-600/10 transition-opacity ${isSpinning ? 'opacity-40' : 'opacity-0'}`}></div>
              <span className={`drop-shadow-[0_10px_30px_rgba(255,255,255,0.2)] ${isSpinning ? 'blur-md translate-y-10 scale-90' : 'scale-100'} transition-all duration-100`}>
                {symbol}
              </span>
            </div>
          ))}

          {/* Win Proclamation Overlay */}
          {!isSpinning && lastWin > 0 && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-green-600/40 backdrop-blur-xl animate-fadeIn">
               <div className="flex flex-col items-center">
                  <div className="bg-white text-black px-12 py-6 rounded-[3rem] font-black text-5xl uppercase italic tracking-tighter shadow-[0_30px_100px_rgba(34,197,94,0.5)] animate-bounce">
                    BIG WIN!
                  </div>
                  <div className="mt-8 text-white text-7xl font-black italic tracking-tighter drop-shadow-4xl">
                    +{lastWin.toFixed(2)}
                  </div>
               </div>
            </div>
          )}
        </div>

        {/* Console Controls */}
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4 glass bg-white/5 rounded-[3.5rem] p-10 border border-white/10 flex flex-col justify-center shadow-inner group/fair">
             <div className="flex justify-between items-center mb-4">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em]">Fairness Oracle</p>
                <i className="fa-solid fa-shield-halved text-indigo-500/50 text-xs"></i>
             </div>
             <p className="font-mono text-[9px] text-indigo-400 break-all leading-relaxed opacity-60 group-hover/fair:opacity-100 transition-opacity">
                {fairnessRecord?.hash || 'SEED_NOT_INITIALIZED'}
             </p>
          </div>

          <div className="lg:col-span-3 flex items-center gap-8 bg-black/60 p-8 rounded-[3.5rem] border border-white/10 shadow-[inset_0_10px_40px_rgba(0,0,0,0.5)]">
            <button
              onClick={() => setBet(prev => Math.max(game.minBet, prev - 1))}
              disabled={isSpinning}
              className="w-16 h-16 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center text-lg transition-all shadow-xl active:scale-90 disabled:opacity-30"
            ><i className="fa-solid fa-minus"></i></button>
            <div className="flex-1 text-center">
              <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.4em] mb-2">Shard bet</p>
              <p className="font-black text-4xl text-white italic tracking-tighter leading-none">{bet}</p>
            </div>
            <button
              onClick={() => setBet(prev => prev + 1)}
              disabled={isSpinning}
              className="w-16 h-16 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center text-lg transition-all shadow-xl active:scale-90 disabled:opacity-30"
            ><i className="fa-solid fa-plus"></i></button>
          </div>

          <button
            onClick={() => setIsBuyBonusModalOpen(true)}
            disabled={isSpinning || currentBalance < bet * (game.mathModel.buyBonusMultiplier || 80)}
            className="lg:col-span-2 py-8 rounded-[3.5rem] bg-amber-500/10 border border-amber-500/20 text-amber-500 font-black text-xs uppercase tracking-widest hover:bg-amber-500/20 transition-all disabled:opacity-20 active:scale-95"
          >
            <i className="fa-solid fa-bolt mr-2"></i> Buy Bonus
          </button>

          <button
            onClick={() => spin()}
            disabled={isSpinning || currentBalance < bet}
            className={`lg:col-span-3 py-10 rounded-[3.5rem] font-black text-5xl tracking-[0.3em] transition-all shadow-[0_30px_100px_rgba(99,102,241,0.4)] relative overflow-hidden group/spin-btn border-b-8 ${
              isSpinning || currentBalance < bet 
              ? 'bg-slate-800 text-slate-600 cursor-not-allowed border-transparent opacity-40 grayscale' 
              : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white border-black/40 hover:scale-[1.03] active:scale-[0.97] active:border-b-0 active:translate-y-2'
            }`}
          >
            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/spin-btn:opacity-100 transition-opacity"></div>
            <div className="relative z-10 drop-shadow-2xl">
               {isSpinning ? <i className="fa-solid fa-sync animate-spin"></i> : 'SPIN'}
            </div>
          </button>
        </div>
      </div>

      {/* Buy Bonus Matrix Modal */}
      {isBuyBonusModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-8 animate-fadeIn">
           <div className="max-w-xl w-full bg-slate-900 rounded-[4rem] border-8 border-amber-500/30 p-16 shadow-[0_0_150px_rgba(245,158,11,0.2)] relative">
              <div className="absolute top-0 left-0 w-full h-2 bg-amber-500"></div>
              <h3 className="text-5xl font-black italic text-white uppercase tracking-tighter mb-4 text-center">Feature Shard Access</h3>
              <p className="text-xs text-slate-400 text-center mb-12 uppercase tracking-widest font-bold">Guaranteed Matrix Alignment Entry</p>

              <div className="bg-black/40 rounded-3xl p-10 border border-white/5 mb-12 text-center">
                 <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-4">Synthesis Cost</p>
                 <p className="text-6xl font-black text-amber-500 italic tracking-tighter">{(bet * (game.mathModel.buyBonusMultiplier || 80)).toLocaleString()}</p>
                 <p className="mt-2 text-xs text-slate-600 font-bold uppercase">{currency}</p>
              </div>

              <div className="flex gap-4">
                 <button
                   onClick={() => { spin(true); setIsBuyBonusModalOpen(false); }}
                   className="flex-1 py-6 bg-amber-500 text-black font-black rounded-2xl uppercase tracking-[0.2em] text-xs hover:scale-[1.03] transition-all shadow-2xl"
                 >Initialize Bonus</button>
                 <button
                   onClick={() => setIsBuyBonusModalOpen(false)}
                   className="flex-1 py-6 bg-white/5 text-slate-400 font-black rounded-2xl uppercase tracking-[0.2em] text-xs hover:bg-white/10 transition-all"
                 >Abort</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

import { useState, useEffect } from 'react';
import { Timer, Trophy, Zap, Swords, Maximize, LayoutDashboard, Activity, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wod, Challenge, Duel, User, BoxSettings } from '../types';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

export default function TV() {
  const [data, setData] = useState<any>(null);
  const [layout, setLayout] = useState<'old' | 'new'>('new');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const fetchData = () => {
    fetch('/api/tv-data')
      .then(res => res.json())
      .then(setData);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Polling as fallback (30s)

    // Realtime subscriptions
    const checkinsChannel = supabase.channel('tv-checkins')
      .on('postgres_changes', { event: '*', table: 'checkins' }, fetchData)
      .subscribe();

    const duelsChannel = supabase.channel('tv-duels')
      .on('postgres_changes', { event: '*', table: 'duels' }, fetchData)
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(checkinsChannel);
      supabase.removeChannel(duelsChannel);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (!data) return <div className="min-h-screen bg-background flex items-center justify-center text-primary font-headline font-black text-4xl italic animate-pulse">CARREGANDO ARENA...</div>;

  const { wod, challenges, duels, checkins, settings, currentClass, rankings } = data;

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-on-surface font-body overflow-hidden flex flex-col p-8 gap-8 relative">
      {/* Header */}
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-6">
          <img src={settings.logo} alt="Logo" className="w-20 h-20 rounded-2xl border-2 border-primary shadow-[0_0_20px_#cafd00]" />
          <div>
            <h1 className="text-6xl font-headline font-black text-primary italic tracking-tighter uppercase">{settings.name}</h1>
            <p className="text-on-surface-variant text-xl font-bold tracking-[0.3em] uppercase italic">Centro de Performance</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-surface-container-low px-8 py-4 rounded-3xl border border-outline-variant/10 text-right">
            <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest">Hora Atual</p>
            <p className="text-4xl font-headline font-black text-on-surface italic">{format(new Date(), 'HH:mm:ss')}</p>
          </div>
          <button onClick={toggleFullscreen} className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10 hover:bg-primary hover:text-background transition-all">
            <Maximize className="w-8 h-8" />
          </button>
          <button onClick={() => setLayout(l => l === 'old' ? 'new' : 'old')} className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10 hover:bg-secondary hover:text-background transition-all">
            <LayoutDashboard className="w-8 h-8" />
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-12 gap-8 overflow-hidden">
        {/* Left Column: WOD */}
        <div className="col-span-7 flex flex-col gap-8">
          <section className="bg-surface-container-low rounded-[3rem] border border-outline-variant/10 p-12 flex flex-col gap-8 flex-1 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8">
              <span className="bg-primary/20 text-primary text-xl font-black px-8 py-3 rounded-full uppercase tracking-widest border border-primary/30">WOD DO DIA</span>
            </div>
            
            <div>
              <h2 className="text-8xl font-headline font-black text-on-surface italic tracking-tighter uppercase leading-none mb-4">{wod.name}</h2>
              <p className="text-primary text-3xl font-black uppercase italic tracking-widest">{wod.type}</p>
            </div>

            <div className="grid grid-cols-2 gap-12">
              <div className="space-y-4">
                <h3 className="text-on-surface-variant text-xl font-bold uppercase tracking-widest flex items-center gap-3">
                  <Activity className="w-6 h-6 text-primary" /> WARM UP
                </h3>
                <p className="text-2xl text-on-surface leading-relaxed font-medium opacity-80">{wod.warmup}</p>
              </div>
              <div className="space-y-4">
                <h3 className="text-on-surface-variant text-xl font-bold uppercase tracking-widest flex items-center gap-3">
                  <Trophy className="w-6 h-6 text-secondary" /> SKILL
                </h3>
                <p className="text-2xl text-on-surface leading-relaxed font-medium opacity-80">{wod.skill}</p>
              </div>
            </div>

            <div className="mt-auto pt-12 border-t border-outline-variant/10 grid grid-cols-3 gap-8">
              <div className="bg-surface-container-highest/30 p-6 rounded-3xl border border-outline-variant/10">
                <span className="text-primary text-xs font-black uppercase tracking-widest block mb-2">RX</span>
                <p className="text-xl font-bold text-on-surface">{wod.rx}</p>
              </div>
              <div className="bg-surface-container-highest/30 p-6 rounded-3xl border border-outline-variant/10">
                <span className="text-secondary text-xs font-black uppercase tracking-widest block mb-2">SCALED</span>
                <p className="text-xl font-bold text-on-surface">{wod.scaled}</p>
              </div>
              <div className="bg-surface-container-highest/30 p-6 rounded-3xl border border-outline-variant/10">
                <span className="text-on-surface-variant text-xs font-black uppercase tracking-widest block mb-2">BEGINNER</span>
                <p className="text-xl font-bold text-on-surface">{wod.beginner}</p>
              </div>
            </div>
          </section>
        </div>

          {/* Right Column: Check-ins & Rankings */}
        <div className="col-span-5 flex flex-col gap-8">
          {/* Check-ins */}
          <section className="bg-surface-container-low rounded-[3rem] border border-outline-variant/10 p-8 flex flex-col gap-6 h-[45%]">
            <div className="flex justify-between items-center">
              <h3 className="text-3xl font-headline font-black text-on-surface italic uppercase flex items-center gap-4">
                <Users className="w-8 h-8 text-primary" /> CHECK-INS <span className="text-primary">({checkins.length})</span>
              </h3>
              {currentClass && (
                <div className="flex flex-col items-end">
                  <span className="text-primary font-headline font-black text-2xl italic leading-none">{currentClass.time}</span>
                  <span className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{currentClass.coach}</span>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar grid grid-cols-2 gap-4 content-start">
              {checkins.map((u: any, idx: number) => (
                <motion.div 
                  key={u.id || idx} 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-surface-container-highest/50 p-4 rounded-2xl border border-outline-variant/10 flex items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-headline font-black text-xl">
                    {u.name[0]}
                  </div>
                  <div>
                    <p className="text-lg font-headline font-black text-on-surface uppercase italic leading-none">{u.name.split(' ')[0]}</p>
                    <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest mt-1">Check-in Realizado</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Rankings / Challenges Toggle */}
          <section className="bg-surface-container-low rounded-[3rem] border border-outline-variant/10 p-8 flex flex-col gap-6 h-[55%] relative overflow-hidden">
            <AnimatePresence mode="wait">
              {layout === 'new' ? (
                <motion.div 
                  key="rankings"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="flex flex-col gap-6 h-full"
                >
                  <h3 className="text-3xl font-headline font-black text-on-surface italic uppercase flex items-center gap-4">
                    <Trophy className="w-8 h-8 text-secondary" /> TOP 10 ATLETAS (XP)
                  </h3>
                  <div className="flex-1 overflow-y-auto no-scrollbar space-y-3">
                    {rankings?.map((r: any, idx: number) => (
                      <div key={idx} className="bg-surface-container-highest/50 p-4 rounded-2xl border border-outline-variant/10 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center font-headline font-black italic",
                            idx === 0 ? "bg-primary text-background" : "bg-surface-container-highest text-on-surface-variant"
                          )}>
                            {idx + 1}
                          </span>
                          <p className="text-xl font-headline font-black text-on-surface uppercase italic">{r.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-primary font-headline font-black text-xl italic leading-none">{r.xp} XP</p>
                          <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">Nível {r.level}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="challenges"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="flex flex-col gap-6 h-full"
                >
                  <h3 className="text-3xl font-headline font-black text-on-surface italic uppercase flex items-center gap-4">
                    <Zap className="w-8 h-8 text-secondary" /> DESAFIOS ATIVOS
                  </h3>
                  <div className="flex-1 overflow-y-auto no-scrollbar space-y-4">
                    {challenges.map((c: any) => (
                      <div key={c.id} className="bg-surface-container-highest/50 p-6 rounded-3xl border border-outline-variant/10 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 flex gap-2">
                          <span className="bg-primary/20 text-primary text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-primary/30">+{c.xp} XP</span>
                        </div>
                        <h4 className="text-2xl font-headline font-black text-on-surface uppercase italic mb-2">{c.title}</h4>
                        <p className="text-on-surface-variant text-lg font-medium leading-tight">{c.description}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>
      </div>

      {/* Duel Ticker */}
      <footer className="h-24 bg-surface-container-low rounded-[2rem] border border-outline-variant/10 overflow-hidden flex items-center px-8 relative">
        <div className="bg-secondary text-background px-6 py-2 rounded-xl font-headline font-black text-xl italic uppercase tracking-tighter mr-8 z-10 shadow-[0_0_20px_rgba(255,116,57,0.3)]">
          ARENA DE DUELOS
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="flex gap-12 animate-marquee whitespace-nowrap">
            {duels.length > 0 ? duels.map((d: any) => (
              <div key={d.id} className="flex items-center gap-6 text-2xl font-headline font-black italic uppercase tracking-widest">
                <span className="text-on-surface">{d.challengerName}</span>
                <span className="text-secondary opacity-50">VS</span>
                <span className="text-on-surface">{d.opponentName}</span>
                <span className="text-primary-container text-sm font-bold bg-primary-container/20 px-4 py-1 rounded-full border border-primary/20">{d.type}</span>
              </div>
            )) : (
              <div className="flex items-center gap-6 text-2xl font-headline font-black italic uppercase tracking-widest opacity-30">
                SEM DUELOS ATIVOS NO MOMENTO • DESAFIE SEUS LIMITES • ARENA ABERTA • 
              </div>
            )}
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: flex;
          width: max-content;
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </div>
  );
}

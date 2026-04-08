import { useState, useEffect } from 'react';
import { Trophy, Zap, Calendar, Timer, ChevronDown, ChevronUp, User, Medal } from 'lucide-react';
import { cn } from '../lib/utils';
import { User as UserType } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

export default function Leaderboard() {
  const [rankings, setRankings] = useState<{ xpRank: UserType[], freqRank: UserType[] } | null>(null);
  const [activeTab, setActiveTab] = useState<'xp' | 'freq' | 'wod'>('xp');
  const [isExpanded, setIsExpanded] = useState(false);

  const fetchRankings = () => {
    fetch('/api/rankings')
      .then(res => res.json())
      .then(setRankings);
  };

  useEffect(() => {
    fetchRankings();

    const channel = supabase
      .channel('rankings_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchRankings())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkins' }, () => fetchRankings())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (!rankings) return <div className="min-h-screen bg-background flex items-center justify-center text-primary font-headline font-black text-2xl italic animate-pulse">CARREGANDO RANKINGS...</div>;

  const currentRank = activeTab === 'xp' ? rankings.xpRank : rankings.freqRank;
  const top3 = currentRank.slice(0, 3);
  const others = currentRank.slice(3);

  return (
    <div className="flex flex-col gap-6 p-4 pt-8 min-h-screen bg-background">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-black text-on-surface tracking-tight uppercase italic flex items-center gap-3">
          <Trophy className="w-8 h-8 text-primary" />
          RANKING
        </h1>
      </header>

      {/* Tabs */}
      <div className="flex bg-surface-container-low p-1 rounded-2xl border border-outline-variant/10">
        {(['xp', 'freq', 'wod'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-3 rounded-xl font-headline font-bold text-[10px] uppercase tracking-widest transition-all",
              activeTab === tab ? "bg-primary text-background shadow-lg" : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            {tab === 'xp' ? 'XP GERAL' : tab === 'freq' ? 'FREQUÊNCIA' : 'RANK WOD'}
          </button>
        ))}
      </div>

      {/* Podium */}
      <div className="flex items-end justify-center gap-4 pt-12 pb-8 relative">
        {/* 2nd Place */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-outline-variant/30 overflow-hidden bg-surface-container-highest">
              <span className="text-2xl flex items-center justify-center h-full">🥈</span>
            </div>
            <div className="absolute -top-2 -right-2 bg-outline-variant/30 text-on-surface text-[10px] font-black px-2 py-0.5 rounded-full">#2</div>
          </div>
          <div className="text-center">
            <p className="text-xs font-headline font-black text-on-surface uppercase italic truncate max-w-[80px]">{top3[1]?.name.split(' ')[0]}</p>
            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
              {activeTab === 'xp' ? `${top3[1]?.xp} XP` : `${top3[1]?.monthCheckinCount || 0} Check-ins`}
            </p>
          </div>
          <div className="w-16 h-20 bg-surface-container-low rounded-t-2xl border-x border-t border-outline-variant/10 flex flex-col items-center justify-center">
            <span className="text-[10px] font-headline font-black text-on-surface-variant italic">LVL {top3[1]?.level}</span>
          </div>
        </div>

        {/* 1st Place */}
        <div className="flex flex-col items-center gap-3 -mt-8">
          <div className="relative">
            <div className="w-24 h-24 rounded-full border-4 border-primary overflow-hidden bg-surface-container-highest shadow-[0_0_30px_rgba(202,253,0,0.3)]">
              <span className="text-4xl flex items-center justify-center h-full">🥇</span>
            </div>
            <div className="absolute -top-3 -right-3 bg-primary text-background text-xs font-black px-3 py-1 rounded-full shadow-lg">#1</div>
          </div>
          <div className="text-center">
            <p className="text-sm font-headline font-black text-primary uppercase italic truncate max-w-[100px]">{top3[0]?.name.split(' ')[0]}</p>
            <p className="text-xs text-on-surface font-bold uppercase tracking-widest">
              {activeTab === 'xp' ? `${top3[0]?.xp} XP` : `${top3[0]?.monthCheckinCount || 0} Check-ins`}
            </p>
          </div>
          <div className="w-24 h-32 bg-primary/10 rounded-t-3xl border-x border-t border-primary/20 flex flex-col items-center justify-center">
            <span className="text-xs font-headline font-black text-primary italic">LVL {top3[0]?.level}</span>
          </div>
        </div>

        {/* 3rd Place */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-secondary/30 overflow-hidden bg-surface-container-highest">
              <span className="text-2xl flex items-center justify-center h-full">🥉</span>
            </div>
            <div className="absolute -top-2 -right-2 bg-secondary/30 text-on-surface text-[10px] font-black px-2 py-0.5 rounded-full">#3</div>
          </div>
          <div className="text-center">
            <p className="text-xs font-headline font-black text-on-surface uppercase italic truncate max-w-[80px]">{top3[2]?.name.split(' ')[0]}</p>
            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
              {activeTab === 'xp' ? `${top3[2]?.xp} XP` : `${top3[2]?.monthCheckinCount || 0} Check-ins`}
            </p>
          </div>
          <div className="w-16 h-16 bg-surface-container-low rounded-t-2xl border-x border-t border-outline-variant/10 flex flex-col items-center justify-center">
            <span className="text-[10px] font-headline font-black text-on-surface-variant italic">LVL {top3[2]?.level}</span>
          </div>
        </div>
      </div>

      {/* List */}
      <section className="bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-6 flex flex-col gap-4">
        <div className="flex justify-between items-center px-2">
          <h3 className="font-headline font-bold text-lg text-on-surface uppercase italic">TODOS ATLETAS</h3>
          <button onClick={() => setIsExpanded(!isExpanded)} className="text-primary text-xs font-bold flex items-center gap-1">
            {isExpanded ? 'RECOLHER' : 'EXPANDIR'} {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        <div className={cn("space-y-3 transition-all duration-500 overflow-hidden", isExpanded ? "max-h-[1000px]" : "max-h-[300px]")}>
          {others.map((u, i) => (
            <div key={u.id} className="bg-surface-container-highest/30 p-4 rounded-2xl border border-outline-variant/10 flex items-center justify-between group hover:border-primary/30 transition-all">
              <div className="flex items-center gap-4">
                <span className="w-6 text-on-surface-variant font-headline font-black text-xs italic">#{i + 4}</span>
                <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface font-headline font-black text-sm">
                  {u.name[0]}
                </div>
                <div>
                  <p className="text-on-surface font-bold uppercase text-sm italic">{u.name}</p>
                  <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">Atleta</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-on-surface font-headline font-black text-sm italic">
                  {activeTab === 'xp' ? `${u.xp} XP` : `${u.monthCheckinCount || 0} Check-ins`}
                </p>
                <div className="flex items-center gap-1 justify-end">
                  <Zap className="w-3 h-3 text-primary" />
                  <span className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest">Nível {u.level}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

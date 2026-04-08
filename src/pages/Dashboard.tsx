import { useState, useEffect } from 'react';
import { Zap, Coins, MapPin, Timer, ChevronRight, Activity, Trophy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';
import { Wod, User } from '../types';
import confetti from 'canvas-confetti';
import AvatarPreview from '../components/AvatarPreview';

export default function Dashboard() {
  const { user, updateUser } = useAuth();
  const [wod, setWod] = useState<Wod | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkinMessage, setCheckinMessage] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<{ time: string; endTime: string; coach: string }[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/wods')
      .then(res => res.json())
      .then(data => setWod(data[0]));
    
    fetch('/api/tv-data')
      .then(res => res.json())
      .then(data => {
        if (data.settings?.announcements) {
          setAnnouncements(data.settings.announcements);
        }
      });
    fetch('/api/schedule')
      .then(res => res.json())
      .then(data => {
        setSchedule(data);
        // Auto-select current class if possible
        const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
        const current = data.find((s: any) => now >= s.time && now <= s.endTime);
        if (current) setSelectedClass(current.time);
      });
  }, []);

  const handleCheckin = () => {
    if (!selectedClass) {
      setCheckinMessage('Por favor, selecione um horário de aula');
      return;
    }
    setIsCheckingIn(true);
    setCheckinMessage(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch('/api/checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              userId: user?.id, 
              lat: latitude, 
              lng: longitude,
              classTime: selectedClass
            }),
          });
          const data = await res.json();
          if (res.ok) {
            setCheckinMessage(`Check-in realizado! +${data.xp} XP, +${data.coins} BrazaCoins`);
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            if (data.levelUp) {
              setTimeout(() => {
                confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 }, colors: ['#CAFD00', '#FFFFFF'] });
              }, 500);
            }
            // Update local user state
            const updatedUser = { 
              ...user!, 
              xp: user!.xp + data.xp, 
              coins: user!.coins + data.coins, 
              level: data.levelUp ? (user!.level + 1) : user!.level,
              checkins: [...user!.checkins, { date: new Date().toISOString().split('T')[0], timestamp: new Date().toISOString(), classTime: selectedClass }] 
            };
            updateUser(updatedUser as User);
          } else {
            setCheckinMessage(data.message);
          }
        } catch (e) {
          setCheckinMessage('Erro ao conectar com o servidor');
        } finally {
          setIsCheckingIn(false);
        }
      },
      (error) => {
        setCheckinMessage('Erro de geolocalização: ' + error.message);
        setIsCheckingIn(false);
      }
    );
  };

  const today = new Date().toISOString().split('T')[0];
  const alreadyCheckedIn = user?.checkins.some(c => c.date === today);

  return (
    <div className="flex flex-col gap-6 p-4 pt-8">
      {/* Header */}
      <header className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <AvatarPreview equipped={user?.avatar.equipped!} size="sm" className="border-2" />
          <div>
            <h1 className="text-2xl font-headline font-black text-on-surface tracking-tight uppercase italic leading-none">
              OLÁ, <span className="text-primary">{user?.name?.split(' ')[0] || 'ATLETA'}</span>
            </h1>
            <p className="text-on-surface-variant text-[10px] font-bold tracking-widest uppercase mt-1 italic">Pronto para o treino?</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-full border border-outline-variant/10">
            <span className="text-[10px] font-black text-primary uppercase italic">LVL {user?.level}</span>
            <div className="w-[1px] h-3 bg-outline-variant/20"></div>
            <Zap className="w-4 h-4 text-primary fill-primary" />
            <span className="font-headline font-black text-sm text-on-surface">{user?.xp}</span>
          </div>
          <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-full border border-outline-variant/10">
            <Coins className="w-4 h-4 text-secondary fill-secondary" />
            <span className="font-headline font-black text-sm text-on-surface">{user?.coins}</span>
            <span className="text-[8px] font-bold text-on-surface-variant uppercase tracking-widest">BC</span>
          </div>
        </div>
      </header>

      {/* Announcements */}
      {announcements.length > 0 && (
        <section className="bg-primary/10 border border-primary/20 rounded-3xl p-4 overflow-hidden relative">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-4 h-4 text-primary fill-primary animate-pulse" />
            <h3 className="text-[10px] font-black text-primary uppercase tracking-widest italic">COMUNICADOS</h3>
          </div>
          <div className="flex flex-col gap-2">
            {announcements.map((ann, idx) => (
              <p key={idx} className="text-xs font-bold text-on-surface leading-tight italic">
                • {ann}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* Check-in Section */}
      <section className="space-y-4">
        {!alreadyCheckedIn && (
          <div className="bg-surface-container-low p-4 rounded-3xl border border-outline-variant/10 space-y-3">
            <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest px-2">SELECIONE SEU HORÁRIO:</label>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {schedule.map((s) => (
                <button
                  key={s.time}
                  onClick={() => setSelectedClass(s.time)}
                  className={cn(
                    "flex flex-col items-center min-w-[80px] p-3 rounded-2xl border transition-all",
                    selectedClass === s.time 
                      ? "bg-primary border-primary text-background" 
                      : "bg-surface-container-highest border-outline-variant/20 text-on-surface"
                  )}
                >
                  <span className="text-sm font-headline font-black">{s.time}</span>
                  <span className={cn("text-[8px] font-bold uppercase tracking-tighter", selectedClass === s.time ? "text-background/60" : "text-on-surface-variant")}>
                    {s.coach.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleCheckin}
          disabled={isCheckingIn || alreadyCheckedIn}
          className={cn(
            "w-full py-6 rounded-3xl font-headline font-black text-xl shadow-lg transition-all uppercase italic tracking-tight flex items-center justify-center gap-3",
            alreadyCheckedIn 
              ? "bg-surface-container-highest text-on-surface-variant cursor-not-allowed opacity-50" 
              : "bg-primary text-background hover:scale-[0.98] active:scale-95 shadow-[0_10px_30px_rgba(202,253,0,0.2)]"
          )}
        >
          {isCheckingIn ? "VALIDANDO..." : alreadyCheckedIn ? "CHECK-IN REALIZADO" : "FAZER CHECK-IN AGORA"}
          <MapPin className={cn("w-6 h-6", alreadyCheckedIn ? "text-on-surface-variant" : "fill-current")} />
        </button>
        {checkinMessage && (
          <p className="text-center text-[10px] font-bold uppercase tracking-widest mt-2 text-primary">{checkinMessage}</p>
        )}
      </section>

      {/* Daily WOD Preview */}
      <section className="bg-surface-container-low rounded-[2rem] border border-outline-variant/10 p-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4">
          <span className="bg-primary/20 text-primary text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">HOJE</span>
        </div>
        <h3 className="font-headline font-black text-2xl text-on-surface mb-1 uppercase italic tracking-tight">WOD DO DIA</h3>
        <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-4">{wod?.name || 'Carregando...'}</p>
        
        <div className="flex gap-4 mb-6">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Tipo</span>
            <span className="text-sm font-headline font-black text-on-surface uppercase italic">{wod?.type}</span>
          </div>
          <div className="w-[1px] bg-outline-variant/20"></div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Time Cap</span>
            <span className="text-sm font-headline font-black text-on-surface uppercase italic">20:00</span>
          </div>
        </div>

        <button className="w-full bg-surface-container-highest text-on-surface py-4 rounded-2xl font-headline font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary hover:text-background transition-all uppercase italic">
          VER DETALHES <ChevronRight className="w-4 h-4" />
        </button>
      </section>

      {/* Quick Stats */}
      <section className="grid grid-cols-2 gap-4">
        <div className="bg-surface-container-low p-5 rounded-3xl border border-outline-variant/10 flex flex-col gap-3">
          <div className="bg-primary/20 w-10 h-10 rounded-xl flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Check-ins Semana</p>
            <p className="text-2xl font-headline font-black text-on-surface">
              {user?.checkins.filter(c => {
                const checkinDate = new Date(c.timestamp);
                const now = new Date();
                const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
                return checkinDate >= startOfWeek;
              }).length}/6
            </p>
          </div>
        </div>
        <div className="bg-surface-container-low p-5 rounded-3xl border border-outline-variant/10 flex flex-col gap-3">
          <div className="bg-secondary/20 w-10 h-10 rounded-xl flex items-center justify-center">
            <Trophy className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Ranking Box</p>
            <p className="text-2xl font-headline font-black text-on-surface">#12</p>
          </div>
        </div>
      </section>
    </div>
  );
}

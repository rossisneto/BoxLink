import { useState, useEffect } from 'react';
import { 
  Activity, 
  Bolt, 
  Dumbbell, 
  Timer, 
  UserRound, 
  Swords,
  ChevronRight,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface Athlete {
  id: string;
  name: string;
  role: string;
  hr: number;
  reps: number;
  image: string;
  progress: number; // Percentage 0-100
  hasWatch: boolean;
}

interface WodResult {
  time: string;
  athletes: Athlete[];
  date: string;
}

// --- Mock Data ---
const INITIAL_ATHLETES: Athlete[] = [
  {
    id: '1',
    name: 'MARCUS R.',
    role: 'ELITE MEMBER',
    hr: 164,
    reps: 142,
    image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1000&auto=format&fit=crop',
    progress: 0,
    hasWatch: true
  },
  {
    id: '2',
    name: 'SARAH V.',
    role: 'PRO MEMBER',
    hr: 158,
    reps: 138,
    image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1000&auto=format&fit=crop',
    progress: 0,
    hasWatch: true
  },
  {
    id: '3',
    name: 'LUCAS V.',
    role: 'ELITE MEMBER',
    hr: 152,
    reps: 120,
    image: 'https://images.unsplash.com/photo-1594381898411-846e7d193883?q=80&w=1000&auto=format&fit=crop',
    progress: 0,
    hasWatch: false
  },
  {
    id: '4',
    name: 'JULIA M.',
    role: 'PRO MEMBER',
    hr: 145,
    reps: 110,
    image: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=1000&auto=format&fit=crop',
    progress: 0,
    hasWatch: true
  }
];

const RANKING = [
  { rank: '01', name: 'SARAH V.', pts: '2,450 PTS', active: true },
  { rank: '02', name: 'LUCAS V.', pts: '2,210 PTS', active: false },
];

export default function App() {
  const [time, setTime] = useState(new Date());
  const [currentAthleteIndex, setCurrentAthleteIndex] = useState(0);
  const [isWodActive, setIsWodActive] = useState(false);
  const [wodSeconds, setWodSeconds] = useState(0);
  const [athletes, setAthletes] = useState<Athlete[]>(INITIAL_ATHLETES);
  const [lastWodResult, setLastWodResult] = useState<WodResult | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    const athleteTimer = setInterval(() => {
      setCurrentAthleteIndex((prev) => (prev + 1) % athletes.length);
    }, 8000);
    return () => {
      clearInterval(timer);
      clearInterval(athleteTimer);
    };
  }, [athletes.length]);

  // WOD Timer and Progress Simulation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isWodActive) {
      interval = setInterval(() => {
        setWodSeconds((prev) => prev + 1);
        
        // Simulate progress
        setAthletes((prev) => prev.map(athlete => ({
          ...athlete,
          progress: Math.min(100, athlete.progress + Math.random() * 2),
          hr: athlete.hasWatch ? (140 + Math.floor(Math.random() * 40)) : 0
        })));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isWodActive]);

  const formattedTime = time.toLocaleTimeString('en-GB', { hour12: false });
  const formatWodTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentAthlete = athletes[currentAthleteIndex];

  const handleStartWod = () => {
    if (isWodActive) {
      // Saving results before stopping
      const result: WodResult = {
        time: formatWodTime(wodSeconds),
        athletes: [...athletes].sort((a, b) => b.progress - a.progress),
        date: new Date().toLocaleString('pt-BR')
      };
      setLastWodResult(result);
      setIsWodActive(false);
      setWodSeconds(0);
      setAthletes(INITIAL_ATHLETES);
      setShowHistory(true); // Auto-show results when stopped
    } else {
      setIsWodActive(true);
      setShowHistory(false);
    }
  };

  return (
    <div className="bg-background text-on-surface font-body overflow-hidden h-screen w-screen selection:bg-primary-container selection:text-on-primary-container">
      {/* Top Navigation Bar */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-12 py-6 bg-[#0e0e0e]/80 backdrop-blur-xl shadow-[0_0_20px_rgba(202,253,0,0.1)]">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-4">
            <div className="bg-primary p-2 rounded-xl rotate-3 shadow-[0_0_15px_rgba(202,253,0,0.3)]">
              <Zap className="w-6 h-6 text-background fill-current" />
            </div>
            <div className="flex flex-col">
              <span className="text-3xl font-black text-on-surface tracking-tighter font-headline uppercase italic leading-none">
                CROSSCITY <span className="text-primary">HUB</span>
              </span>
              <span className="font-headline font-bold text-primary tracking-[0.3em] text-[10px] uppercase opacity-80">
                CROSSFIT ELITE
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <span className="font-headline font-bold text-4xl text-on-surface">{isWodActive ? formatWodTime(wodSeconds) : formattedTime}</span>
          <button 
            onClick={handleStartWod}
            className={`${isWodActive ? 'bg-secondary text-on-surface' : 'bg-primary-container text-on-primary-fixed'} font-headline font-bold px-10 py-4 text-xl rounded-xl transition-all hover:scale-95 duration-150 ease-in-out cursor-pointer shadow-[0_0_20px_rgba(202,253,0,0.3)]`}
          >
            {isWodActive ? 'STOP WOD' : 'START WOD'}
          </button>
        </div>
      </header>

      {/* Side Navigation Bar */}
      <aside className="fixed left-0 top-0 h-full flex flex-col items-center py-24 gap-8 bg-[#131313] w-24 border-r border-[#201f1f] z-40">
        <button 
          onClick={() => setShowHistory(!showHistory)}
          className={`flex flex-col items-center gap-1 mb-8 p-3 rounded-xl transition-all ${showHistory ? 'bg-primary-container text-background' : 'text-primary-container hover:bg-white/5'}`}
        >
          <Activity className="w-8 h-8" />
          <span className="text-[10px] font-headline font-bold">HISTORY</span>
        </button>
        <div className="flex flex-col gap-10 w-full items-center">
          <div className="group relative flex flex-col items-center gap-2 text-on-surface-variant hover:text-primary transition-transform duration-300 cursor-pointer">
            <Dumbbell className="w-6 h-6" />
            <span className="text-[10px] font-headline font-bold">WARM-UP</span>
          </div>
          <div className="group relative flex flex-col items-center gap-2 text-on-surface-variant hover:text-primary transition-transform duration-300 cursor-pointer">
            <Bolt className="w-6 h-6" />
            <span className="text-[10px] font-headline font-bold">SKILL</span>
          </div>
          <div className="group relative flex flex-col items-center gap-2 bg-primary-container text-[#0e0e0e] py-4 w-full shadow-[4px_0_15px_rgba(202,253,0,0.3)] rounded-r-xl cursor-pointer">
            <Timer className="w-6 h-6" />
            <span className="text-[10px] font-headline font-bold">WOD</span>
          </div>
          <div className="group relative flex flex-col items-center gap-2 text-on-surface-variant hover:text-primary transition-transform duration-300 cursor-pointer">
            <UserRound className="w-6 h-6" />
            <span className="text-[10px] font-headline font-bold">COOL-DOWN</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="pl-24 pt-28 pb-12 pr-4 h-full grid grid-cols-12 gap-6">
        <AnimatePresence mode="wait">
          {!isWodActive ? (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="col-span-12 grid grid-cols-12 gap-6 h-full"
            >
              {/* Left Section: Workout Flow */}
              <section className="col-span-8 flex flex-col gap-6">
                <div className="grid grid-cols-2 gap-6 h-[40%]">
                  {/* Warm-up Card */}
                  <div className="bg-surface-container-low rounded-xl p-6 border-l-4 border-primary/30 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <h2 className="font-headline text-3xl font-black tracking-tighter text-on-surface">WARM-UP</h2>
                        <span className="bg-surface-container-highest px-3 py-1 rounded text-[10px] font-headline font-bold text-on-surface-variant uppercase">08:00 MIN</span>
                      </div>
                      <ul className="space-y-4 font-headline">
                        <li className="flex items-center gap-4 text-xl text-primary">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                          400M RUN <span className="text-on-surface-variant text-sm ml-auto">STEADY PACE</span>
                        </li>
                        <li className="flex items-center gap-4 text-xl text-on-surface">
                          <span className="w-1.5 h-1.5 rounded-full bg-outline-variant"></span>
                          20 AIR SQUATS
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Skill Card */}
                  <div className="bg-surface-container-low rounded-xl p-6 border-l-4 border-tertiary-fixed-dim/30">
                    <div className="flex justify-between items-start mb-4">
                      <h2 className="font-headline text-3xl font-black tracking-tighter text-on-surface">SKILL</h2>
                      <span className="bg-tertiary-fixed/10 text-tertiary-fixed px-3 py-1 rounded text-[10px] font-headline font-bold uppercase">TECHNIQUE</span>
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-2xl font-headline font-bold text-tertiary-fixed">SNATCH FOCUS</h3>
                      <div className="flex gap-4">
                        <div className="bg-surface-container-highest p-3 rounded-lg flex-1">
                          <span className="block text-[10px] text-on-surface-variant font-headline uppercase">Sets</span>
                          <span className="text-xl font-headline font-bold">5 x 3</span>
                        </div>
                        <div className="bg-surface-container-highest p-3 rounded-lg flex-1">
                          <span className="block text-[10px] text-on-surface-variant font-headline uppercase">Load</span>
                          <span className="text-xl font-headline font-bold">65% 1RM</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* The WOD Card */}
                <div className="bg-surface-container-high rounded-xl p-8 flex-grow relative overflow-hidden glow-lime border border-primary/10">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Timer className="w-48 h-48" />
                  </div>
                  <div className="relative z-10 flex flex-col h-full">
                    <div className="flex justify-between items-end mb-8">
                      <div>
                        <span className="text-secondary font-headline font-bold tracking-[0.3em] text-sm block mb-1">MAIN EVENT</span>
                        <h1 className="text-7xl font-headline font-black tracking-tighter text-primary italic uppercase">THE WOD</h1>
                      </div>
                      <div className="text-right">
                        <span className="text-6xl font-headline font-black text-on-surface block tracking-tighter">AMRAP 20</span>
                        <div className="flex gap-2 mt-2 justify-end">
                          <span className="bg-secondary/20 text-secondary border border-secondary/30 px-3 py-1 rounded-full text-[10px] font-headline font-bold uppercase tracking-wider">RX</span>
                          <span className="bg-surface-container-highest text-on-surface-variant px-3 py-1 rounded-full text-[10px] font-headline font-bold uppercase tracking-wider">SCALED</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col justify-center flex-grow space-y-12 max-w-2xl">
                      <motion.div 
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="flex items-center gap-10 group cursor-pointer"
                      >
                        <span className="text-primary-dim font-headline text-5xl font-light opacity-50">01</span>
                        <span className="text-6xl font-headline font-bold text-on-surface group-hover:translate-x-4 transition-transform duration-300 uppercase">15 PULLUPS</span>
                      </motion.div>
                      <motion.div 
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="flex items-center gap-10 group cursor-pointer"
                      >
                        <span className="text-primary-dim font-headline text-5xl font-light opacity-50">02</span>
                        <span className="text-6xl font-headline font-bold text-on-surface group-hover:translate-x-4 transition-transform duration-300 uppercase">30 PUSHUPS</span>
                      </motion.div>
                      <motion.div 
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className="flex items-center gap-10 group cursor-pointer"
                      >
                        <span className="text-primary-dim font-headline text-5xl font-light opacity-50">03</span>
                        <span className="text-6xl font-headline font-bold text-on-surface group-hover:translate-x-4 transition-transform duration-300 uppercase">45 SQUATS</span>
                      </motion.div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Right Section: Check-In & Ranking */}
              <section className="col-span-4 flex flex-col gap-6">
                {/* Athlete Check-In Carousel */}
                <div className="bg-surface-container-low rounded-xl p-6 h-auto flex flex-col overflow-hidden relative">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex flex-col gap-1">
                      <h2 className="font-headline text-xl font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                        <UserRound className="w-5 h-5" />
                        CHECK-IN <span className="text-on-surface-variant font-normal text-sm ml-2">14/20</span>
                      </h2>
                      <span className="text-secondary font-headline font-bold text-sm tracking-widest">CLASS TIME: 09:00 AM</span>
                    </div>
                    <div className="flex gap-1">
                      {athletes.map((_, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === currentAthleteIndex ? 'bg-primary' : 'bg-outline-variant'}`}></div>
                      ))}
                    </div>
                  </div>

                  <div className="relative flex-grow h-[420px]">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentAthlete.id}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="absolute inset-0 flex flex-col bg-surface-container-high/40 rounded-2xl border border-primary/20 overflow-hidden group"
                      >
                        <div className="relative h-3/5 overflow-hidden">
                          <img 
                            src={currentAthlete.image} 
                            alt={currentAthlete.name}
                            className="w-full h-full object-cover object-top filter grayscale hover:grayscale-0 transition-all duration-500"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-surface-container-low via-transparent to-transparent"></div>
                          <div className="absolute bottom-4 left-6">
                            <span className="bg-primary text-background px-3 py-1 text-[10px] font-black tracking-[0.2em] uppercase rounded-sm mb-2 inline-block shadow-[0_0_15px_rgba(202,253,0,0.4)]">
                              {currentAthlete.role}
                            </span>
                            <h3 className="text-4xl font-headline font-black text-on-surface tracking-tighter uppercase italic">{currentAthlete.name}</h3>
                          </div>
                        </div>
                        <div className="p-6 flex-grow flex flex-col justify-between">
                          <div className="flex justify-between items-center">
                            <div className="flex flex-col">
                              <span className="text-[10px] text-on-surface-variant font-bold tracking-widest uppercase mb-1">Current Performance</span>
                              <div className="flex items-center gap-4">
                                <div className="flex flex-col">
                                  <span className="text-xs text-primary/70 font-bold uppercase">HR</span>
                                  <span className="text-2xl font-headline font-bold text-on-surface leading-tight">{currentAthlete.hr}</span>
                                </div>
                                <div className="h-8 w-px bg-outline-variant/30"></div>
                                <div className="flex flex-col">
                                  <span className="text-xs text-primary/70 font-bold uppercase">REPS</span>
                                  <span className="text-2xl font-headline font-bold text-on-surface leading-tight">{currentAthlete.reps}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] text-on-surface-variant font-bold tracking-widest uppercase mb-1">Next Up</span>
                              <div className="flex items-center gap-1 text-primary animate-pulse cursor-pointer">
                                <span className="text-xs font-bold">SARAH V.</span>
                                <ChevronRight className="w-4 h-4" />
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1.5 mt-4">
                            <div className="h-1 flex-grow rounded-full bg-primary"></div>
                            <div className="h-1 flex-grow rounded-full bg-surface-container-highest"></div>
                            <div className="h-1 flex-grow rounded-full bg-surface-container-highest"></div>
                            <div className="h-1 flex-grow rounded-full bg-surface-container-highest"></div>
                          </div>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>

                {/* Box Ranking */}
                <div className="flex-grow flex flex-col gap-6">
                  <div className="bg-surface-container-low rounded-xl p-6 flex flex-col gap-4 border-t-2 border-primary-container/20">
                    <h2 className="font-headline text-lg font-bold uppercase tracking-widest text-on-surface">BOX RANKING</h2>
                    <div className="flex flex-col gap-3">
                      {RANKING.map((item) => (
                        <div 
                          key={item.rank}
                          className={`flex items-center justify-between p-4 rounded-lg ${item.active ? 'bg-primary-container text-on-primary-fixed' : 'bg-surface-container-highest opacity-70'}`}
                        >
                          <div className="flex items-center gap-4">
                            <span className="font-headline font-black text-2xl">{item.rank}</span>
                            <span className="font-bold text-lg">{item.name}</span>
                          </div>
                          <span className="font-black">{item.pts}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </motion.div>
          ) : (
            <motion.div 
              key="active-wod"
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="col-span-12 grid grid-cols-12 gap-6 h-full"
            >
              {/* Left: WOD Details */}
              <div className="col-span-4 flex flex-col gap-6">
                <div className="bg-surface-container-high rounded-xl p-8 border-l-8 border-primary glow-lime h-full">
                  <span className="text-secondary font-headline font-bold tracking-[0.3em] text-sm block mb-2">ACTIVE WOD</span>
                  <h1 className="text-6xl font-headline font-black text-primary italic uppercase mb-8">AMRAP 20</h1>
                  
                  <div className="space-y-10">
                    <div className="flex flex-col gap-2">
                      <span className="text-primary-dim font-headline text-2xl opacity-50">01</span>
                      <span className="text-4xl font-headline font-bold text-on-surface uppercase">15 PULLUPS</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="text-primary-dim font-headline text-2xl opacity-50">02</span>
                      <span className="text-4xl font-headline font-bold text-on-surface uppercase">30 PUSHUPS</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="text-primary-dim font-headline text-2xl opacity-50">03</span>
                      <span className="text-4xl font-headline font-bold text-on-surface uppercase">45 SQUATS</span>
                    </div>
                  </div>

                  <div className="mt-12 p-6 bg-surface-container-highest rounded-xl border border-outline-variant/30">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest block mb-2">Coach Notes</span>
                    <p className="text-on-surface text-lg leading-relaxed">
                      Maintain a steady pace. Focus on full range of motion for pushups. Break squats into sets of 15 if needed.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: Competition Progress */}
              <div className="col-span-8 flex flex-col gap-6">
                <div className="bg-surface-container-low rounded-xl p-8 flex-grow flex flex-col">
                  <div className="flex justify-between items-center mb-10">
                    <h2 className="font-headline text-3xl font-black uppercase tracking-widest text-on-surface flex items-center gap-4">
                      <Swords className="w-8 h-8 text-secondary" />
                      LIVE COMPETITION
                    </h2>
                    <div className="flex items-center gap-4">
                      <span className="bg-surface-container-highest px-4 py-2 rounded-lg font-headline font-bold text-on-surface-variant">
                        {athletes.length} ATHLETES CONNECTED
                      </span>
                    </div>
                  </div>

                  <div className="flex-grow space-y-8">
                    {athletes.sort((a, b) => b.progress - a.progress).map((athlete, index) => (
                      <div key={athlete.id} className="flex flex-col gap-3">
                        <div className="flex justify-between items-end">
                          <div className="flex items-center gap-4">
                            <span className={`font-headline font-black text-2xl ${index === 0 ? 'text-primary' : 'text-on-surface-variant'}`}>
                              {index + 1 < 10 ? `0${index + 1}` : index + 1}
                            </span>
                            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary/30">
                              <img src={athlete.image} alt={athlete.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-headline font-bold text-xl text-on-surface">{athlete.name}</span>
                              <span className="text-[10px] text-on-surface-variant font-bold tracking-widest uppercase">{athlete.role}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] text-primary/70 font-bold uppercase">HEART RATE</span>
                              <span className="text-xl font-headline font-bold text-on-surface">
                                {athlete.hasWatch ? (
                                  <>{athlete.hr} <span className="text-xs opacity-50">BPM</span></>
                                ) : (
                                  <span className="text-xs opacity-30 italic">NOT CONNECTED</span>
                                )}
                              </span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] text-secondary font-bold uppercase">PROGRESS</span>
                              <span className="text-xl font-headline font-bold text-on-surface">{Math.floor(athlete.progress)}%</span>
                            </div>
                          </div>
                        </div>
                        <div className="h-4 w-full bg-surface-container-highest rounded-full overflow-hidden relative">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${athlete.progress}%` }}
                            className={`h-full rounded-full ${index === 0 ? 'bg-primary shadow-[0_0_15px_rgba(202,253,0,0.5)]' : 'bg-primary/40'}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Marquee */}
      <footer className="fixed bottom-0 left-0 w-full z-50 flex items-center bg-[#0e0e0e] h-12 overflow-hidden border-t-2 border-secondary/30 shadow-[0_-10px_30px_rgba(255,116,57,0.15)]">
        <div className="animate-marquee flex items-center gap-12 text-secondary font-headline text-sm tracking-[0.2em] font-bold">
          <span className="flex items-center gap-2"><Swords className="w-4 h-4" /> DUEL ACTIVE: MARCUS R. VS SARAH V.</span>
          <span className="text-white opacity-20">||</span>
          <span>LEADERBOARD UPDATING IN REAL-TIME</span>
          <span className="text-white opacity-20">||</span>
          <span>BOX FREQUENCY: 92% OPTIMAL</span>
          <span className="text-white opacity-20">||</span>
          <span className="text-primary">NEW BOX RECORD: JULIA M. (156 REPS)</span>
          <span className="text-white opacity-20">||</span>
          <span>UPCOMING: HYPERTROPHY STRENGTH @ 18:00</span>
          <span className="text-white opacity-20">||</span>
          <span className="flex items-center gap-2"><Swords className="w-4 h-4" /> DUEL ACTIVE: MARCUS R. VS SARAH V.</span>
          <span className="text-white opacity-20">||</span>
          <span>LEADERBOARD UPDATING IN REAL-TIME</span>
        </div>
      </footer>

      {/* History / Results Modal */}
      <AnimatePresence>
        {showHistory && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-12"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-surface-container-low w-full max-w-5xl rounded-3xl border border-primary/20 overflow-hidden shadow-[0_0_50px_rgba(202,253,0,0.15)]"
            >
              <div className="p-10 border-b border-outline-variant/30 flex justify-between items-center bg-surface-container-high">
                <div>
                  <h2 className="text-5xl font-headline font-black text-primary italic uppercase tracking-tighter">WOD RESULTS</h2>
                  <p className="text-on-surface-variant font-headline font-bold tracking-widest mt-2">
                    {lastWodResult ? `COMPLETED AT: ${lastWodResult.date}` : 'NO RECENT RESULTS'}
                  </p>
                </div>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="bg-surface-container-highest p-4 rounded-full hover:bg-primary hover:text-background transition-all"
                >
                  <ChevronRight className="w-8 h-8 rotate-180" />
                </button>
              </div>

              <div className="p-10 max-h-[60vh] overflow-y-auto">
                {lastWodResult ? (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center mb-8 bg-primary/5 p-6 rounded-2xl border border-primary/10">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-primary uppercase tracking-widest">TOTAL TIME</span>
                        <span className="text-6xl font-headline font-black text-on-surface">{lastWodResult.time}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-secondary uppercase tracking-widest">WOD TYPE</span>
                        <span className="text-4xl font-headline font-black text-on-surface block">AMRAP 20</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {lastWodResult.athletes.map((athlete, index) => (
                        <div key={athlete.id} className="flex items-center justify-between p-6 bg-surface-container-high rounded-2xl border border-outline-variant/20">
                          <div className="flex items-center gap-6">
                            <span className={`text-3xl font-headline font-black ${index === 0 ? 'text-primary' : 'text-on-surface-variant'}`}>
                              {index + 1 < 10 ? `0${index + 1}` : index + 1}
                            </span>
                            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/20">
                              <img src={athlete.image} alt={athlete.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-2xl font-headline font-bold text-on-surface">{athlete.name}</span>
                              <span className="text-xs text-on-surface-variant font-bold tracking-widest uppercase">{athlete.role}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-12">
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] text-on-surface-variant font-bold uppercase">SCORE</span>
                              <span className="text-3xl font-headline font-black text-primary">{Math.floor(athlete.progress)}%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant">
                    <Timer className="w-20 h-20 opacity-20 mb-4" />
                    <p className="text-2xl font-headline font-bold uppercase tracking-widest">Start a WOD to record results</p>
                  </div>
                )}
              </div>
              
              <div className="p-8 bg-surface-container-high border-t border-outline-variant/30 flex justify-center">
                <button 
                  onClick={() => setShowHistory(false)}
                  className="bg-primary-container text-on-primary-fixed font-headline font-bold px-12 py-4 rounded-2xl text-xl hover:scale-95 transition-all"
                >
                  CLOSE RESULTS
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { formatInTimeZone } from "date-fns-tz";
import cors from "cors";
import bodyParser from "body-parser";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const TIMEZONE = "America/Sao_Paulo";

app.use(cors());
app.use(bodyParser.json());

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const getSupabase = (useServiceRole = false) => {
  return createClient(supabaseUrl, useServiceRole ? supabaseServiceKey : supabaseKey);
};

// Helper to add rewards
async function addReward(userId: string, type: string, xp: number, coins: number, description: string) {
  const { data: profile } = await getSupabase(true).from('profiles').select('xp, coins, level').eq('id', userId).single();
  if (!profile) return null;

  const newXp = (profile.xp || 0) + xp;
  const newCoins = (profile.coins || 0) + coins;
  
  // Simple level up logic
  const xpToNextLevel = profile.level * 100;
  let newLevel = profile.level;
  let levelUp = false;
  
  if (newXp >= xpToNextLevel) {
    newLevel += 1;
    levelUp = true;
  }

  await getSupabase(true).from('profiles').update({ xp: newXp, coins: newCoins, level: newLevel }).eq('id', userId);
  await getSupabase(true).from('reward_history').insert({ user_id: userId, type, xp, coins, description });
  
  return { levelUp };
}

// API Routes
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.get("/api/tv-data", async (req, res) => {
  const { data: settings } = await getSupabase().from('box_settings').select('*').single();
  const { data: economy } = await getSupabase().from('avatar_economy_settings').select('*').eq('is_active', true).single();
  
  const today = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
  const { data: wod } = await getSupabase().from('wods').select('*').eq('date', today).single();
  
  const { data: checkins } = await getSupabase().from('checkins').select('*, profiles(name, avatar_equipped)').eq('date', today);
  const { data: challenges } = await getSupabase().from('challenges').select('*').eq('active', true);
  const { data: duels } = await getSupabase().from('duels').select('*, challenger:profiles!challenger_id(name), opponent:profiles!opponent_id(name)').eq('status', 'accepted');
  const { data: rankings } = await getSupabase().from('profiles').select('name, xp, level, avatar_equipped').order('xp', { ascending: false }).limit(10);
  
  // Mocked stats for the ticker
  const stats = {
    frequency: "92% OPTIMAL",
    newRecord: "JULIA M. (158 REPS)",
    upcoming: "HYPERTROPHY STRENGTH"
  };

  res.json({
    settings: settings || { name: "CrossCity Hub", logo: "" },
    rewards: economy,
    wod: wod || { name: "WOD de Hoje", type: "AMRAP", warmup: "400M RUN\n20 AIR SQUATS", skill: "SNATCH FOCUS\n5 x 3 @ 65% 1RM", rx: "A definir", scaled: "A definir", beginner: "A definir" },
    checkins: checkins || [],
    challenges: challenges || [],
    duels: (duels || []).map(d => ({
      ...d,
      challengerName: (d.challenger as any)?.name,
      opponentName: (d.opponent as any)?.name
    })),
    rankings: rankings || [],
    stats
  });
});

app.get("/api/rankings", async (req, res) => {
  const { data: xpRank } = await getSupabase().from('profiles').select('*').order('xp', { ascending: false }).limit(20);
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

  const { data: checkins } = await getSupabase().from('checkins').select('user_id').gte('date', dateStr);
  
  const freqMap: Record<string, number> = {};
  checkins?.forEach(c => {
    freqMap[c.user_id] = (freqMap[c.user_id] || 0) + 1;
  });

  const { data: allUsers } = await getSupabase().from('profiles').select('*');
  const freqRank = (allUsers || []).map(u => ({
    ...u,
    monthCheckinCount: freqMap[u.id] || 0
  })).sort((a, b) => b.monthCheckinCount - a.monthCheckinCount).slice(0, 20);

  res.json({ xpRank: xpRank || [], freqRank });
});

app.get("/api/schedule", async (req, res) => {
  const { data } = await getSupabase().from('schedule').select('*').order('time');
  res.json(data || []);
});

app.get("/api/wods", async (req, res) => {
  const { data } = await getSupabase().from('wods').select('*').order('date', { ascending: false });
  res.json(data || []);
});

app.post("/api/wods", async (req, res) => {
  const { date, name, type, warmup, skill, rx, scaled, beginner } = req.body;
  const { data, error } = await getSupabase().from('wods').insert({
    date, name, type, warmup, skill, rx, scaled, beginner
  }).select().single();
  
  if (error) return res.status(400).json({ message: error.message });
  res.json(data);
});

app.get("/api/wods/results/:wodId", async (req, res) => {
  const { wodId } = req.params;
  const { data } = await getSupabase()
    .from('wod_results')
    .select('*, profiles(name)')
    .eq('wod_id', wodId)
    .order('created_at', { ascending: false });
  res.json(data || []);
});

app.post("/api/wods/results", async (req, res) => {
  const { userId, wodId, result, type } = req.body;
  const { data, error } = await getSupabase().from('wod_results').insert({
    user_id: userId,
    wod_id: wodId,
    result,
    type
  }).select().single();
  
  if (error) return res.status(400).json({ message: error.message });
  res.json(data);
});

app.post("/api/checkin", async (req, res) => {
  const { userId, lat, lng, classTime } = req.body;
  const today = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
  
  // Check if already checked in
  const { data: existing } = await getSupabase().from('checkins').select('*').eq('user_id', userId).eq('date', today).single();
  if (existing) return res.status(400).json({ message: "Check-in já realizado hoje" });

  // Get box settings to verify location
  const { data: settings } = await getSupabase().from('box_settings').select('*').single();
  const { data: economy } = await getSupabase().from('avatar_economy_settings').select('*').eq('is_active', true).single();
  
  if (settings) {
    const R = 6371e3; // metres
    const φ1 = lat * Math.PI/180;
    const φ2 = settings.lat * Math.PI/180;
    const Δφ = (settings.lat-lat) * Math.PI/180;
    const Δλ = (settings.lng-lng) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c; // in metres

    if (d > (settings.radius || 500)) {
      return res.status(400).json({ message: "Você está muito longe do box para fazer check-in" });
    }
  }

  const xp = economy?.xp_per_checkin || 10;
  const coins = economy?.coins_per_checkin || 5;

  const { error } = await getSupabase().from('checkins').insert({
    user_id: userId,
    date: today,
    class_time: classTime,
    lat,
    lng
  });

  if (error) return res.status(400).json({ message: error.message });

  const rewardResult = await addReward(userId, 'checkin', xp, coins, `Check-in: ${classTime}`);
  res.json({ success: true, xp, coins, levelUp: rewardResult?.levelUp });
});

app.post("/api/shop/buy", async (req, res) => {
  const { userId, itemId } = req.body;
  const { data: profile } = await getSupabase().from('profiles').select('*').eq('id', userId).single();
  const { data: item } = await getSupabase().from('items').select('*').eq('id', itemId).single();
  
  if (!profile || !item) return res.status(404).json({ message: "Perfil ou item não encontrado" });
  if (profile.coins < item.price) return res.status(400).json({ message: "Saldo insuficiente" });
  
  const inventory = profile.avatar?.inventory || [];
  if (inventory.includes(itemId)) return res.status(400).json({ message: "Item já adquirido" });
  
  const newInventory = [...inventory, itemId];
  const { error } = await getSupabase().from('profiles').update({
    coins: profile.coins - item.price,
    avatar: { ...profile.avatar, inventory: newInventory }
  }).eq('id', userId);
  
  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true });
});

app.post("/api/avatar/equip", async (req, res) => {
  const { userId, equipped } = req.body;
  const { error } = await getSupabase().from('profiles').update({
    avatar: { equipped, inventory: [] } // inventory will be merged by the update logic if needed, but here we assume the client sends the full avatar object or we handle it carefully
  }).eq('id', userId);
  
  // Actually, we should fetch the current profile to preserve inventory
  const { data: profile } = await getSupabase().from('profiles').select('avatar').eq('id', userId).single();
  if (profile) {
    await getSupabase().from('profiles').update({
      avatar: { ...profile.avatar, equipped }
    }).eq('id', userId);
  }

  res.json({ success: true });
});

app.get("/api/coach/results", async (req, res) => {
  const today = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
  const { data: wods } = await getSupabase().from('wods').select('id').eq('date', today);
  if (!wods || wods.length === 0) return res.json([]);
  
  const { data } = await getSupabase()
    .from('wod_results')
    .select('*, profiles(name)')
    .in('wod_id', wods.map(w => w.id))
    .order('created_at', { ascending: false });
    
  res.json(data || []);
});

app.get("/api/coach/athletes", async (req, res) => {
  const today = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
  const { data, error } = await getSupabase()
    .from('checkins')
    .select('*, profiles(*)')
    .eq('date', today);
    
  if (error) return res.status(400).json({ message: error.message });
  res.json(data || []);
});

app.get("/api/user/wod-history/:userId", async (req, res) => {
  const { userId } = req.params;
  const { data } = await getSupabase()
    .from('wod_results')
    .select('*, wods(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  res.json(data || []);
});

app.get("/api/user/history/:userId", async (req, res) => {
  const { userId } = req.params;
  const { data } = await getSupabase().from('reward_history').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  res.json(data || []);
});

app.get("/api/user/prs/:userId", async (req, res) => {
  const { userId } = req.params;
  const { data } = await getSupabase().from('personal_records').select('*').eq('user_id', userId);
  res.json(data || []);
});

app.post("/api/user/prs", async (req, res) => {
  const { userId, exercise, value, date } = req.body;
  const { data: existing } = await getSupabase().from('personal_records').select('*').eq('user_id', userId).eq('exercise', exercise).single();
  
  if (existing) {
    await getSupabase().from('personal_records').update({ value, date }).eq('id', existing.id);
  } else {
    await getSupabase().from('personal_records').insert({ user_id: userId, exercise, value, date });
  }
  
  const { data } = await getSupabase().from('personal_records').select('*').eq('user_id', userId);
  res.json(data);
});

app.get("/api/challenges", async (req, res) => {
  const { data } = await getSupabase().from('challenges').select('*').order('created_at', { ascending: false });
  res.json(data || []);
});

app.post("/api/challenges", async (req, res) => {
  const { title, description, active, startDate, endDate, xp, coins, repeatable, dailyLimit, difficulty } = req.body;
  const { data, error } = await getSupabase().from('challenges').insert({
    title, description, active, start_date: startDate, end_date: endDate, xp, coins, repeatable, daily_limit: dailyLimit, difficulty
  }).select().single();
  
  if (error) return res.status(400).json({ message: error.message });
  res.json(data);
});

app.post("/api/challenges/complete", async (req, res) => {
  const { userId, challengeId } = req.body;
  const { data: challenge } = await getSupabase().from('challenges').select('*').eq('id', challengeId).single();
  if (!challenge) return res.status(404).json({ message: "Desafio não encontrado" });
  
  const { data: economy } = await getSupabase().from('avatar_economy_settings').select('*').eq('is_active', true).single();
  
  let xp = challenge.xp;
  let coins = challenge.coins;
  
  if (challenge.difficulty && economy) {
    xp = economy[`challenge_${challenge.difficulty}_xp`] || xp;
    coins = economy[`challenge_${challenge.difficulty}_coins`] || coins;
  }
  
  const result = await addReward(userId, 'challenge', xp, coins, `Desafio concluído: ${challenge.title}`);
  res.json({ success: true, xp, coins, levelUp: result?.levelUp });
});

app.post("/api/duels", async (req, res) => {
  const { challengerId, opponentId, type, reward } = req.body;
  const { data, error } = await getSupabase().from('duels').insert({
    challenger_id: challengerId,
    opponent_id: opponentId,
    type,
    reward_xp: reward.xp,
    reward_coins: reward.coins,
    status: 'pending',
    created_at: new Date().toISOString()
  }).select().single();
  
  if (error) return res.status(400).json({ message: error.message });
  res.json(data);
});

app.post("/api/duels/respond", async (req, res) => {
  const { duelId, status } = req.body;
  const { data, error } = await getSupabase().from('duels').update({ status }).eq('id', duelId).select().single();
  
  if (error) return res.status(400).json({ message: error.message });
  res.json(data);
});

app.get("/api/duels/history/:userId", async (req, res) => {
  const { userId } = req.params;
  const { data, error } = await getSupabase()
    .from('duels')
    .select('*, challenger:profiles!challenger_id(*), opponent:profiles!opponent_id(*)')
    .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
    .eq('status', 'finished')
    .order('created_at', { ascending: false });
    
  if (error) return res.status(400).json({ message: error.message });
  res.json(data || []);
});

app.post("/api/duels/finish", async (req, res) => {
  const { duelId, winnerId } = req.body;
  const { data: duel } = await getSupabase().from('duels').select('*').eq('id', duelId).single();
  if (!duel) return res.status(404).json({ message: "Duelo não encontrado" });
  
  await getSupabase().from('duels').update({ status: 'finished', winner_id: winnerId }).eq('id', duelId);
  
  const { data: economy } = await getSupabase().from('avatar_economy_settings').select('*').eq('is_active', true).single();
  
  const award = async (userId: string, isWinner: boolean) => {
    const xp = isWinner ? (economy?.duel_win_xp || 40) : (economy?.duel_loss_xp || 15);
    const coins = isWinner ? (economy?.duel_win_coins || 10) : 0;
    await addReward(userId, 'duel', xp, coins, isWinner ? "Vitória em duelo" : "Participação em duelo");
  };
  
  await award(duel.challenger_id, duel.challenger_id === winnerId);
  await award(duel.opponent_id, duel.opponent_id === winnerId);
  
  res.json({ success: true });
});

app.post("/api/admin/schedule", async (req, res) => {
  const { id, time, endTime, coach, capacity, days, isActive, checkinWindowMinutes } = req.body;
  if (!time || !endTime || !coach) return res.status(400).json({ message: "Dados incompletos" });
  
  const payload = { 
    time, 
    end_time: endTime, 
    coach, 
    capacity: capacity || 20,
    days: days || [1,2,3,4,5],
    is_active: isActive !== undefined ? isActive : true,
    checkin_window_minutes: checkinWindowMinutes || 60
  };

  if (id) {
    await getSupabase().from('schedule').update(payload).eq('id', id);
  } else {
    await getSupabase().from('schedule').insert(payload);
  }
  
  const { data: schedule } = await getSupabase().from('schedule').select('*').order('time');
  res.json({ success: true, schedule });
});

app.delete("/api/admin/schedule/:id", async (req, res) => {
  const { id } = req.params;
  await getSupabase().from('schedule').delete().eq('id', id);
  const { data: schedule } = await getSupabase().from('schedule').select('*').order('time');
  res.json({ success: true, schedule });
});

app.post("/api/admin/settings", async (req, res) => {
  const { 
    name, logo, description, institutionalPhoto, topBanner, 
    lat, lng, radius, tvLayout, tvConfig, 
    rewards, isActive, announcements, timezone, modules 
  } = req.body;
  
  const { data: settings } = await getSupabase().from('box_settings').select('*').single();
  const payload = {
    name,
    logo,
    description,
    institutional_photo: institutionalPhoto,
    top_banner: topBanner,
    lat,
    lng,
    radius,
    tv_layout: tvLayout,
    tv_config: tvConfig,
    timezone,
    modules,
    is_active: isActive,
    announcements,
    updated_at: new Date().toISOString()
  };

  if (settings) {
    await getSupabase().from('box_settings').update(payload).eq('id', settings.id);
  } else {
    await getSupabase().from('box_settings').insert(payload);
  }

  if (rewards) {
    const { data: economy } = await getSupabase().from('avatar_economy_settings').select('*').eq('is_active', true).single();
    if (economy) {
      await getSupabase().from('avatar_economy_settings').update(rewards).eq('id', economy.id);
    } else {
      await getSupabase().from('avatar_economy_settings').insert({ ...rewards, is_active: true });
    }
  }

  const { data: updatedSettings } = await getSupabase().from('box_settings').select('*').single();
  const { data: updatedEconomy } = await getSupabase().from('avatar_economy_settings').select('*').eq('is_active', true).single();
  
  const responseSettings = {
    ...updatedSettings,
    tvLayout: updatedSettings?.tv_layout,
    isActive: updatedSettings?.is_active,
    institutionalPhoto: updatedSettings?.institutional_photo,
    topBanner: updatedSettings?.top_banner,
    tvConfig: updatedSettings?.tv_config,
    modules: updatedSettings?.modules,
    rewards: updatedEconomy,
    location: { lat: updatedSettings?.lat, lng: updatedSettings?.lng }
  };
  
  res.json({ success: true, settings: responseSettings });
});

// Admin routes
app.get("/api/admin/users", async (req, res) => {
  const { data } = await getSupabase().from('profiles').select('*');
  res.json(data || []);
});

app.post("/api/admin/seed-items", async (req, res) => {
  const items = [
    { id: 'shirt-black', name: 'Camiseta Preta', slot: 'top', price: 150, image: 'https://picsum.photos/seed/shirt1/200/200' },
    { id: 'shirt-white', name: 'Camiseta Branca', slot: 'top', price: 150, image: 'https://picsum.photos/seed/shirt2/200/200' },
    { id: 'shorts-black', name: 'Shorts Preto', slot: 'bottom', price: 120, image: 'https://picsum.photos/seed/shorts1/200/200' },
    { id: 'shoes-nano', name: 'Tênis Nano X', slot: 'shoes', price: 500, image: 'https://picsum.photos/seed/shoes1/200/200' },
    { id: 'cap-braza', name: 'Boné Braza', slot: 'head_accessory', price: 80, image: 'https://picsum.photos/seed/cap1/200/200' },
  ];

  const { error } = await getSupabase().from('items').upsert(items);
  if (error) return res.status(500).json({ message: error.message });
  res.json({ success: true, message: 'Itens semeados com sucesso' });
});

app.post("/api/admin/seed-test-data", async (req, res) => {
  const { userId } = req.body;
  
  // Seed WODs
  const wods = [
    { 
      date: new Date().toISOString().split('T')[0], 
      name: 'MURPH ADAPTADO', 
      type: 'FOR TIME', 
      warmup: '3 rounds: 200m Run, 10 Air Squats, 10 Pushups',
      skill: 'Pull-up technique',
      rx: '1 mile Run, 100 Pull-ups, 200 Push-ups, 300 Air Squats, 1 mile Run',
      scaled: '800m Run, 50 Ring Rows, 100 Push-ups, 150 Air Squats, 800m Run',
      beginner: '400m Run, 30 Ring Rows, 60 Push-ups, 90 Air Squats, 400m Run'
    }
  ];
  await getSupabase().from('wods').upsert(wods);

  // Seed Challenges
  const challenges = [
    {
      title: 'GUERREIRO DA MANHÃ',
      description: 'Faça 3 check-ins no horário das 06:00 ou 07:00 nesta semana.',
      active: true,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      xp: 100,
      coins: 20,
      repeatable: false,
      dailyLimit: 1,
      difficulty: 'medium'
    }
  ];
  await getSupabase().from('challenges').upsert(challenges);

  res.json({ success: true });
});

app.get("/api/profile/:userId", async (req, res) => {
  const { userId } = req.params;
  const { data, error } = await getSupabase().from('profiles').select('*').eq('id', userId).single();
  if (error) return res.status(404).json({ message: "Perfil não encontrado" });
  res.json(data);
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ message: error.message });
  
  const { data: profile } = await getSupabase().from('profiles').select('*').eq('id', data.user.id).single();
  res.json(profile);
});

app.post("/api/auth/signup", async (req, res) => {
  const { email, password, name } = req.body;
  const { data, error } = await getSupabase().auth.signUp({ email, password });
  if (error) return res.status(400).json({ message: error.message });
  
  if (data.user) {
    const { error: profileError } = await getSupabase(true).from('profiles').insert({
      id: data.user.id,
      email,
      name,
      role: 'student',
      status: 'pending',
      xp: 0,
      coins: 0,
      level: 1
    });
    if (profileError) console.error('Error creating profile:', profileError);
  }
  
  res.json({ success: true });
});

app.post("/api/admin/users/status", async (req, res) => {
  const { userId, status, role } = req.body;
  const update: any = { status };
  if (role) update.role = role;
  
  const { data, error } = await getSupabase().from('profiles').update(update).eq('id', userId).select().single();
  if (error) return res.status(400).json({ message: error.message });
  res.json(data);
});

// Store Management
app.get("/api/admin/items", async (req, res) => {
  const { data } = await getSupabase().from('items').select('*').order('created_at', { ascending: false });
  res.json(data || []);
});

app.post("/api/admin/items", async (req, res) => {
  const { id, name, slot, price, image } = req.body;
  const { data, error } = await getSupabase().from('items').upsert({ id, name, slot, price, image }).select().single();
  if (error) return res.status(400).json({ message: error.message });
  res.json(data);
});

app.delete("/api/admin/items/:id", async (req, res) => {
  const { id } = req.params;
  await getSupabase().from('items').delete().eq('id', id);
  res.json({ success: true });
});

// Duels Management
app.get("/api/admin/duels", async (req, res) => {
  const { data } = await getSupabase()
    .from('duels')
    .select('*, challenger:profiles!challenger_id(*), opponent:profiles!opponent_id(*)')
    .order('created_at', { ascending: false });
  res.json(data || []);
});

// WOD History for Admin
app.get("/api/admin/wods", async (req, res) => {
  const { data } = await getSupabase().from('wods').select('*').order('date', { ascending: false });
  res.json(data || []);
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

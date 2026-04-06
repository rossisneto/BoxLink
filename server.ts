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
  
  res.json({
    settings: {
      ...settings,
      rewards: economy
    },
    wod,
    checkins
  });
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

app.post("/api/admin/seed-items", async (req, res) => {
  const items = [
    { id: 'cap_red', name: 'Boné Vermelho', slot: 'head_accessory', price: 50, image: '🧢' },
    { id: 'cap_blue', name: 'Boné Azul', slot: 'head_accessory', price: 50, image: '🧢' },
    { id: 'shirt_black', name: 'Camiseta Preta', slot: 'top', price: 100, image: '👕' },
    { id: 'shirt_white', name: 'Camiseta Branca', slot: 'top', price: 100, image: '👕' },
    { id: 'shorts_black', name: 'Shorts Preto', slot: 'bottom', price: 80, image: '🩳' },
    { id: 'shoes_running', name: 'Tênis de Corrida', slot: 'shoes', price: 150, image: '👟' }
  ];
  
  for (const item of items) {
    await getSupabase().from('items').upsert(item);
  }
  
  res.json({ success: true });
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

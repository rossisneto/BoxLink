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

async function fetchUserCheckins(userId: string) {
  const { data } = await getSupabase(true)
    .from('checkins')
    .select('date, timestamp, class_time')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false });

  return (data || []).map((checkin: any) => ({
    date: checkin.date,
    timestamp: checkin.timestamp,
    classTime: checkin.class_time ?? null,
  }));
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
  
  const { data: approvedUsers } = await getSupabase().from('profiles').select('id').eq('status', 'approved');
  const approvedCount = approvedUsers?.length || 0;
  const checkinCount = checkins?.length || 0;
  const frequencyPct = approvedCount > 0 ? Math.round((checkinCount / approvedCount) * 100) : 0;

  const { data: latestResult } = await getSupabase()
    .from('wod_results')
    .select('result, profiles(name), created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const nowTime = formatInTimeZone(new Date(), TIMEZONE, "HH:mm");
  const { data: upcomingClass } = await getSupabase()
    .from('schedule')
    .select('time, coach')
    .eq('is_active', true)
    .gte('time', nowTime)
    .order('time', { ascending: true })
    .limit(1)
    .single();

  const stats = {
    frequency: `${frequencyPct}% FREQUÊNCIA`,
    newRecord: latestResult ? `${(latestResult as any).profiles?.name || 'Atleta'} (${latestResult.result})` : "SEM RESULTADOS",
    upcoming: upcomingClass ? `${upcomingClass.time} • ${upcomingClass.coach}` : "SEM PRÓXIMA AULA"
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

app.get("/api/schedule", async (req, res) => {
  const { data } = await getSupabase().from('schedule').select('*').order('time');
  res.json(data || []);
});

app.get("/api/wods", async (req, res) => {
  const { data } = await getSupabase().from('wods').select('*').order('date', { ascending: false });
  res.json(data || []);
});

app.get("/api/wods/results/:wodId", async (req, res) => {
  const { wodId } = req.params;
  const { data, error } = await getSupabase()
    .from('wod_results')
    .select('*, profiles(name)')
    .eq('wod_id', wodId)
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ message: error.message });
  res.json(data || []);
});

app.post("/api/wods/results", async (req, res) => {
  const { userId, wodId, result, type } = req.body;
  if (!userId || !wodId || !result) return res.status(400).json({ message: "Dados incompletos" });

  const { data, error } = await getSupabase()
    .from('wod_results')
    .insert({
      user_id: userId,
      wod_id: wodId,
      result,
      type: type || 'RX',
    })
    .select()
    .single();

  if (error) return res.status(400).json({ message: error.message });
  res.json(data);
});

app.get("/api/rankings", async (_req, res) => {
  const { data: xpRank, error: xpError } = await getSupabase()
    .from('profiles')
    .select('id, name, email, role, status, xp, coins, level, avatar_equipped, avatar_inventory, paid_bonuses, created_at')
    .eq('status', 'approved')
    .order('xp', { ascending: false });

  if (xpError) return res.status(400).json({ message: xpError.message });

  const currentMonthStart = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-01");
  const { data: monthCheckins } = await getSupabase()
    .from('checkins')
    .select('user_id')
    .gte('date', currentMonthStart);

  const freqMap = new Map<string, number>();
  (monthCheckins || []).forEach((checkin: any) => {
    freqMap.set(checkin.user_id, (freqMap.get(checkin.user_id) || 0) + 1);
  });

  const mappedUsers = (xpRank || []).map((profile: any) => ({
    ...profile,
    avatar: {
      equipped: profile.avatar_equipped,
      inventory: profile.avatar_inventory || [],
    },
    checkins: [],
    paidBonuses: profile.paid_bonuses || [],
    createdAt: profile.created_at,
    monthCheckinCount: freqMap.get(profile.id) || 0,
  }));

  const freqRank = [...mappedUsers].sort((a, b) => (b.monthCheckinCount || 0) - (a.monthCheckinCount || 0));
  res.json({ xpRank: mappedUsers, freqRank });
});

app.post("/api/checkin", async (req, res) => {
  const { userId, classTime } = req.body;
  if (!userId) return res.status(400).json({ message: "userId é obrigatório" });

  const { data, error } = await getSupabase(true).rpc('perform_daily_checkin', {
    p_user_id: userId,
    p_class_time: classTime || null,
    p_timezone: TIMEZONE,
  });

  if (error) return res.status(400).json({ message: error.message });
  if (!data?.success) return res.status(400).json({ message: data?.message || "Não foi possível realizar check-in" });

  res.json({
    success: true,
    message: data.message,
    xp: data.xp_awarded || 0,
    coins: data.coins_awarded || 0,
    levelUp: data.level_up || false,
  });
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
  if (!userId || !challengeId) return res.status(400).json({ message: "Dados incompletos" });

  const { data, error } = await getSupabase(true).rpc('claim_challenge_reward', {
    p_user_id: userId,
    p_challenge_id: challengeId,
    p_timezone: TIMEZONE,
  });

  if (error) return res.status(400).json({ message: error.message });
  if (!data?.success) return res.status(400).json({ message: data?.message || "Não foi possível resgatar recompensa" });

  res.json({
    success: true,
    message: data.message,
    xp: data.xp_awarded || 0,
    coins: data.coins_awarded || 0,
    levelUp: data.level_up || false,
  });
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
  if (!duelId || !winnerId) return res.status(400).json({ message: "Dados incompletos" });

  const { data, error } = await getSupabase(true).rpc('settle_duel_idempotent', {
    p_duel_id: duelId,
    p_winner_id: winnerId,
    p_timezone: TIMEZONE,
  });

  if (error) return res.status(400).json({ message: error.message });
  if (!data?.success) return res.status(400).json({ message: data?.message || "Não foi possível finalizar duelo" });

  res.json({
    success: true,
    message: data.message,
    winnerReward: data.winner_reward || null,
    loserReward: data.loser_reward || null,
    alreadyProcessed: data.already_processed || false,
  });
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

app.get("/api/profile/:userId", async (req, res) => {
  const { userId } = req.params;
  const { data, error } = await getSupabase().from('profiles').select('*').eq('id', userId).single();
  if (error) return res.status(404).json({ message: "Perfil não encontrado" });
  const checkins = await fetchUserCheckins(userId);
  res.json({ ...data, checkins });
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
      role: 'athlete',
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

app.get("/api/items", async (_req, res) => {
  const { data, error } = await getSupabase().from('items').select('*').order('created_at', { ascending: false });
  if (error) return res.status(400).json({ message: error.message });
  res.json(data || []);
});

app.post("/api/shop/buy", async (req, res) => {
  const { userId, itemId } = req.body;
  if (!userId || !itemId) return res.status(400).json({ message: "Dados incompletos" });

  const { data: profile, error: profileError } = await getSupabase(true)
    .from('profiles')
    .select('coins, avatar_inventory')
    .eq('id', userId)
    .single();
  if (profileError || !profile) return res.status(404).json({ message: "Usuário não encontrado" });

  const { data: item, error: itemError } = await getSupabase().from('items').select('*').eq('id', itemId).single();
  if (itemError || !item) return res.status(404).json({ message: "Item não encontrado" });

  const inventory: string[] = profile.avatar_inventory || [];
  if (inventory.includes(itemId)) return res.json({ success: true, coins: profile.coins, inventory });
  if ((profile.coins || 0) < item.price) return res.status(400).json({ message: "Saldo insuficiente" });

  const updatedCoins = profile.coins - item.price;
  const updatedInventory = [...inventory, itemId];

  const { error: updateError } = await getSupabase(true).from('profiles').update({
    coins: updatedCoins,
    avatar_inventory: updatedInventory,
  }).eq('id', userId);

  if (updateError) return res.status(400).json({ message: updateError.message });
  res.json({ success: true, coins: updatedCoins, inventory: updatedInventory });
});

app.post("/api/avatar/equip", async (req, res) => {
  const { userId, itemId, slot } = req.body;
  if (!userId || !slot) return res.status(400).json({ message: "Dados incompletos" });

  const { data: profile, error: profileError } = await getSupabase(true)
    .from('profiles')
    .select('avatar_equipped, avatar_inventory')
    .eq('id', userId)
    .single();
  if (profileError || !profile) return res.status(404).json({ message: "Usuário não encontrado" });

  const equipped = profile.avatar_equipped || {};
  const inventory: string[] = profile.avatar_inventory || [];
  if (itemId && !inventory.includes(itemId)) return res.status(400).json({ message: "Item não está no inventário" });

  equipped[slot] = itemId || null;
  const { error: updateError } = await getSupabase(true).from('profiles').update({ avatar_equipped: equipped }).eq('id', userId);
  if (updateError) return res.status(400).json({ message: updateError.message });

  res.json({ success: true, equipped });
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

-- Phase 3: Critical fixes (duel idempotency, tv real data, RLS cleanup)

-- Remove legacy broad policies that may conflict with tighter policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own checkins" ON public.checkins;
DROP POLICY IF EXISTS "Users can insert their own checkins" ON public.checkins;
DROP POLICY IF EXISTS "Users can view their own rewards" ON public.reward_history;
DROP POLICY IF EXISTS "WOD results are viewable by everyone" ON public.wod_results;
DROP POLICY IF EXISTS "Users can insert their own WOD results" ON public.wod_results;
DROP POLICY IF EXISTS "Users can view their own PRs" ON public.personal_records;
DROP POLICY IF EXISTS "Users can manage their own PRs" ON public.personal_records;

-- Ensure RLS policy set for wod_results and personal_records is explicit and non-conflicting
ALTER TABLE IF EXISTS public.wod_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.personal_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own wod results or admin" ON public.wod_results;
CREATE POLICY "Users read own wod results or admin" ON public.wod_results
FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users insert own wod results or admin" ON public.wod_results;
CREATE POLICY "Users insert own wod results or admin" ON public.wod_results
FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users read own prs or admin" ON public.personal_records;
CREATE POLICY "Users read own prs or admin" ON public.personal_records
FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users manage own prs or admin" ON public.personal_records;
CREATE POLICY "Users manage own prs or admin" ON public.personal_records
FOR ALL USING (auth.uid() = user_id OR public.is_admin(auth.uid()))
WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- Restrict challenge claim visibility to owner/admin
ALTER TABLE IF EXISTS public.challenge_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own challenge claims or admin" ON public.challenge_claims;
CREATE POLICY "Users read own challenge claims or admin" ON public.challenge_claims
FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users insert own challenge claims or admin" ON public.challenge_claims;
CREATE POLICY "Users insert own challenge claims or admin" ON public.challenge_claims
FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- TV public view as minimal read-only payload
CREATE OR REPLACE VIEW public.tv_public_feed
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.name,
  p.level,
  p.xp,
  p.avatar_equipped
FROM public.profiles p
WHERE p.status = 'approved';

GRANT SELECT ON public.tv_public_feed TO anon, authenticated;

-- Duel settlement RPC (idempotent)
CREATE OR REPLACE FUNCTION public.settle_duel_idempotent(
  p_duel_id uuid,
  p_winner_id uuid,
  p_timezone text DEFAULT 'America/Sao_Paulo'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duel public.duels%ROWTYPE;
  v_today date;
  v_winner_id uuid;
  v_loser_id uuid;
  v_win_xp integer := 40;
  v_win_coins integer := 10;
  v_loss_xp integer := 15;
  v_winner_reward jsonb;
  v_loser_reward jsonb;
BEGIN
  v_today := (now() AT TIME ZONE coalesce(p_timezone, 'America/Sao_Paulo'))::date;

  SELECT * INTO v_duel
  FROM public.duels
  WHERE id = p_duel_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Duelo não encontrado');
  END IF;

  IF p_winner_id IS DISTINCT FROM v_duel.challenger_id AND p_winner_id IS DISTINCT FROM v_duel.opponent_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Vencedor inválido para o duelo');
  END IF;

  IF EXISTS (SELECT 1 FROM public.duel_settlements ds WHERE ds.duel_id = p_duel_id) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Duelo já processado', 'already_processed', true);
  END IF;

  v_winner_id := p_winner_id;
  v_loser_id := CASE WHEN v_duel.challenger_id = p_winner_id THEN v_duel.opponent_id ELSE v_duel.challenger_id END;

  SELECT
    coalesce(duel_win_xp, 40),
    coalesce(duel_win_coins, 10),
    coalesce(duel_loss_xp, 15)
  INTO v_win_xp, v_win_coins, v_loss_xp
  FROM public.avatar_economy_settings
  WHERE is_active = true
  ORDER BY updated_at DESC
  LIMIT 1;

  UPDATE public.duels
  SET status = 'finished',
      winner_id = v_winner_id
  WHERE id = p_duel_id;

  v_winner_reward := public.grant_reward_idempotent(
    v_winner_id,
    'duel',
    v_win_xp,
    v_win_coins,
    'Vitória em duelo',
    format('duel:%s:winner:%s:%s', p_duel_id::text, v_winner_id::text, v_today::text)
  );

  v_loser_reward := public.grant_reward_idempotent(
    v_loser_id,
    'duel',
    v_loss_xp,
    0,
    'Participação em duelo',
    format('duel:%s:loser:%s:%s', p_duel_id::text, v_loser_id::text, v_today::text)
  );

  INSERT INTO public.duel_settlements(duel_id)
  VALUES (p_duel_id)
  ON CONFLICT (duel_id) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Duelo finalizado com sucesso',
    'already_processed', false,
    'winner_reward', v_winner_reward,
    'loser_reward', v_loser_reward
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.settle_duel_idempotent(uuid, uuid, text) TO authenticated, service_role;

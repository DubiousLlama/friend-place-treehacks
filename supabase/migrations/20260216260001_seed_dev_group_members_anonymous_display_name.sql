-- Update seed_dev_data to use group_members.anonymous_display_name (no display_name column).

CREATE OR REPLACE FUNCTION seed_dev_data(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group1_id uuid;
  v_group2_id uuid;
  v_game1_id uuid;
  v_game2_id uuid;
  v_game3_id uuid;
  v_slot1_id uuid;
  v_slot2_id uuid;
  v_slot3_id uuid;
  v_invite1 text;
  v_invite2 text;
  v_invite3 text;
BEGIN
  -- Ensure player row exists
  INSERT INTO players (id, display_name, linked_at)
  VALUES (p_user_id, 'Seed User', now())
  ON CONFLICT (id) DO UPDATE SET display_name = COALESCE(players.display_name, 'Seed User');

  -- Create two groups
  INSERT INTO saved_groups (id, owner_id, name, anyone_can_add_members, only_admin_can_remove, daily_game_enabled)
  VALUES (gen_random_uuid(), p_user_id, 'Weekend Crew', true, true, false)
  RETURNING id INTO v_group1_id;

  INSERT INTO saved_groups (id, owner_id, name, anyone_can_add_members, only_admin_can_remove, daily_game_enabled)
  VALUES (gen_random_uuid(), p_user_id, 'Office Friends', true, false, true)
  RETURNING id INTO v_group2_id;

  -- Group members: linked members use players.display_name; anonymous use anonymous_display_name
  INSERT INTO group_members (group_id, player_id, anonymous_display_name, is_anonymous, sort_order)
  VALUES (v_group1_id, p_user_id, NULL, false, 0);
  INSERT INTO group_members (group_id, player_id, anonymous_display_name, is_anonymous, sort_order)
  VALUES (v_group1_id, NULL, 'Alex', true, 1);
  INSERT INTO group_members (group_id, player_id, anonymous_display_name, is_anonymous, sort_order)
  VALUES (v_group1_id, NULL, 'Sam', true, 2);

  INSERT INTO group_members (group_id, player_id, anonymous_display_name, is_anonymous, sort_order)
  VALUES (v_group2_id, p_user_id, NULL, false, 0);
  INSERT INTO group_members (group_id, player_id, anonymous_display_name, is_anonymous, sort_order)
  VALUES (v_group2_id, NULL, 'Jordan', true, 1);

  -- Game 1: placing (active), with group1
  v_invite1 := 'seed-' || substr(md5(random()::text), 1, 8);
  INSERT INTO games (id, invite_code, axis_x_label_low, axis_x_label_high, axis_y_label_low, axis_y_label_high, phase, created_by, group_id)
  VALUES (gen_random_uuid(), v_invite1, 'Left', 'Right', 'Bottom', 'Top', 'placing', p_user_id, v_group1_id)
  RETURNING id INTO v_game1_id;

  -- Game 2: results, with group1
  v_invite2 := 'seed-' || substr(md5(random()::text), 1, 8);
  INSERT INTO games (id, invite_code, axis_x_label_low, axis_x_label_high, axis_y_label_low, axis_y_label_high, phase, created_by, group_id)
  VALUES (gen_random_uuid(), v_invite2, 'Chaos', 'Order', 'Introvert', 'Extrovert', 'results', p_user_id, v_group1_id)
  RETURNING id INTO v_game2_id;

  -- Game 3: results, no group
  v_invite3 := 'seed-' || substr(md5(random()::text), 1, 8);
  INSERT INTO games (id, invite_code, axis_x_label_low, axis_x_label_high, axis_y_label_low, axis_y_label_high, phase, created_by, group_id)
  VALUES (gen_random_uuid(), v_invite3, 'Cereal first', 'Milk first', 'Night owl', 'Early bird', 'results', p_user_id, NULL)
  RETURNING id INTO v_game3_id;

  -- Game players: game 1 (placing) — 3 slots, only user claimed
  INSERT INTO game_players (id, game_id, player_id, display_name, self_x, self_y, has_submitted)
  VALUES (gen_random_uuid(), v_game1_id, p_user_id, 'Seed User', 0.5, 0.5, false)
  RETURNING id INTO v_slot1_id;
  INSERT INTO game_players (game_id, player_id, display_name, self_x, self_y, has_submitted)
  VALUES (v_game1_id, NULL, 'Alex', NULL, NULL, false);
  INSERT INTO game_players (game_id, player_id, display_name, self_x, self_y, has_submitted)
  VALUES (v_game1_id, NULL, 'Sam', NULL, NULL, false);

  -- Game players: game 2 (results) — 3 with scores
  INSERT INTO game_players (id, game_id, player_id, display_name, self_x, self_y, has_submitted, score)
  VALUES (gen_random_uuid(), v_game2_id, p_user_id, 'Seed User', 0.3, 0.7, true, 85.0)
  RETURNING id INTO v_slot2_id;
  INSERT INTO game_players (id, game_id, player_id, display_name, self_x, self_y, has_submitted, score)
  VALUES (gen_random_uuid(), v_game2_id, NULL, 'Alex', 0.8, 0.2, true, 92.0);
  INSERT INTO game_players (id, game_id, player_id, display_name, self_x, self_y, has_submitted, score)
  VALUES (gen_random_uuid(), v_game2_id, NULL, 'Sam', 0.5, 0.5, true, 78.0);

  -- Game players: game 3 (results) — 2 with scores
  INSERT INTO game_players (id, game_id, player_id, display_name, self_x, self_y, has_submitted, score)
  VALUES (gen_random_uuid(), v_game3_id, p_user_id, 'Seed User', 0.6, 0.4, true, 70.0)
  RETURNING id INTO v_slot3_id;
  INSERT INTO game_players (game_id, player_id, display_name, self_x, self_y, has_submitted, score)
  VALUES (v_game3_id, NULL, 'Jordan', 0.4, 0.6, true, 88.0);

  -- Optional: one guess on game 2 so profile has some consensus data (guesser = Alex slot, target = Seed User slot)
  INSERT INTO guesses (game_id, guesser_game_player_id, target_game_player_id, guess_x, guess_y)
  SELECT v_game2_id, gp.id, v_slot2_id, 0.35, 0.65
  FROM game_players gp WHERE gp.game_id = v_game2_id AND gp.display_name = 'Alex' LIMIT 1;

  INSERT INTO guesses (game_id, guesser_game_player_id, target_game_player_id, guess_x, guess_y)
  SELECT v_game2_id, gp.id, v_slot2_id, 0.28, 0.72
  FROM game_players gp WHERE gp.game_id = v_game2_id AND gp.display_name = 'Sam' LIMIT 1;

  RETURN;
END;
$$;

COMMENT ON FUNCTION seed_dev_data(uuid) IS 'Dev only: inserts fake saved_groups, group_members, games, game_players (and some guesses) for the given user. Use from seed.sql or SQL Editor.';

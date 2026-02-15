"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { getGroupStreak } from "@/lib/streak-utils";
import { GameGridPreview } from "@/components/GameGridPreview";
import type { Database } from "@/lib/types/database";

type SavedGroup = Database["public"]["Tables"]["saved_groups"]["Row"];
type GroupMemberRow = Database["public"]["Tables"]["group_members"]["Row"];
/** When selected with .select('*, players(display_name)') */
type GroupMember = GroupMemberRow & { players?: { display_name: string | null } | null };
type Game = Database["public"]["Tables"]["games"]["Row"];

function getMemberDisplayName(m: GroupMember): string {
  if (m.player_id) return m.players?.display_name?.trim() ?? "Member";
  return m.anonymous_display_name?.trim() ?? "Guest";
}

/** Pending invite from API (masked email, no raw PII) */
type PendingInvite = { id: string; masked_email: string; invited_by: string; expires_at: string };
type GamePlayer = Database["public"]["Tables"]["game_players"]["Row"];

interface GameWithWinner {
  game: Game;
  winnerDisplayName: string;
  winnerInitials: string;
}

/** Featured tag for display (no edit) */
interface MemberFeaturedTag {
  label: string;
  agreement_pct: number;
}

function CrownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z" />
    </svg>
  );
}

function IncognitoIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path d="M12 3a6 6 0 0 0-6 6c0 2.5 1.5 4.5 3 5.5-.5.5-1 1.5-1 3v2h8v-2c0-1.5-.5-2.5-1-3 1.5-1 3-3 3-5.5a6 6 0 0 0-6-6z" />
      <circle cx="12" cy="9" r="2" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function SignInToJoinGroup({ groupId }: { groupId: string }) {
  const [signingIn, setSigningIn] = useState(false);
  const supabase = createClient();
  const handleAnon = async () => {
    setSigningIn(true);
    await supabase.auth.signInAnonymously();
    setSigningIn(false);
  };
  return (
    <button
      type="button"
      onClick={handleAnon}
      disabled={signingIn}
      className="rounded-lg bg-splash text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
    >
      {signingIn ? "Signing in…" : "Continue anonymously"}
    </button>
  );
}

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading, isLinked, isAnonymous } = useAuth();
  const groupId = params.id as string;
  const [group, setGroup] = useState<SavedGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [gamesWithWinners, setGamesWithWinners] = useState<GameWithWinner[]>([]);
  const [gamesWonByPlayer, setGamesWonByPlayer] = useState<Record<string, number>>({});
  const [memberFeaturedTags, setMemberFeaturedTags] = useState<Record<string, MemberFeaturedTag[]>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [joinDisplayName, setJoinDisplayName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [memberMenuId, setMemberMenuId] = useState<string | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [dailyEnabled, setDailyEnabled] = useState(false);
  const [anyoneAdd, setAnyoneAdd] = useState(true);
  const [onlyAdminRemove, setOnlyAdminRemove] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [addMemberError, setAddMemberError] = useState<string | null>(null);
  const [addMemberSuccess, setAddMemberSuccess] = useState<string | null>(null);

  const isOwner = user && group && group.owner_id === user.id;
  const myMember = members.find((m) => m.player_id === user?.id);
  const canAddMembers = isOwner || (group?.anyone_can_add_members && myMember);
  const canRemoveMembers = isOwner || !group?.only_admin_can_remove;

  const groupDisplayName = group?.name && group.name.trim() !== "" ? group.name : members.map(getMemberDisplayName).join(", ");

  const fetchGroup = useCallback(async () => {
    if (!user || !groupId) return;
    const supabase = createClient();
    const { data: g, error: ge } = await supabase.from("saved_groups").select("*").eq("id", groupId).single();
    if (ge || !g) {
      setShowJoinForm(true);
      setLoading(false);
      return;
    }
    const { data: mems } = await supabase
      .from("group_members")
      .select("*, players(display_name)")
      .eq("group_id", groupId)
      .order("sort_order", { ascending: true });
    const memberList = (mems ?? []) as GroupMember[];
    const isMember = g.owner_id === user.id || memberList.some((m) => m.player_id === user.id);
    if (!isMember) {
      setShowJoinForm(true);
      setLoading(false);
      return;
    }
    setGroup(g as SavedGroup);
    setMembers(memberList);
    setGroupNameInput(g.name ?? "");
    setDailyEnabled(g.daily_game_enabled);
    setAnyoneAdd(g.anyone_can_add_members);
    setOnlyAdminRemove(g.only_admin_can_remove);

    const playerIds = [...new Set([...memberList.map((m) => m.player_id).filter(Boolean), g.owner_id])] as string[];
    if (playerIds.length > 0) {
      const { data: tagRows } = await supabase
        .from("user_featured_tags")
        .select("user_id, label, agreement_pct")
        .in("user_id", playerIds)
        .order("sort_order", { ascending: true });
      const byUser: Record<string, MemberFeaturedTag[]> = {};
      for (const row of tagRows ?? []) {
        const uid = (row as { user_id: string }).user_id;
        if (!byUser[uid]) byUser[uid] = [];
        byUser[uid].push({ label: row.label, agreement_pct: row.agreement_pct });
      }
      setMemberFeaturedTags(byUser);
    } else {
      setMemberFeaturedTags({});
    }

    const invitesRes = await fetch(`/api/groups/${groupId}/invites`);
    if (invitesRes.ok) {
      const { invites: list } = await invitesRes.json();
      setPendingInvites(list ?? []);
    } else {
      setPendingInvites([]);
    }

    const { data: groupGames } = await supabase
      .from("games")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });
    const games = (groupGames ?? []) as Game[];
    const placing = games.filter((x) => x.phase === "placing");
    const results = games.filter((x) => x.phase === "results");
    const activeFirst = [...placing, ...results];

    const withWinners: GameWithWinner[] = [];
    const wonCount: Record<string, number> = {};
    for (const game of activeFirst) {
      if (game.phase !== "results") {
        withWinners.push({ game, winnerDisplayName: "—", winnerInitials: "—" });
        continue;
      }
      const { data: players } = await supabase.from("game_players").select("id, display_name, score, player_id").eq("game_id", game.id).not("score", "is", null);
      const sorted = (players ?? []).slice().sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      const winner = sorted[0];
      const name = winner?.display_name ?? "—";
      const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
      withWinners.push({ game, winnerDisplayName: name, winnerInitials: initials });
      if (winner?.player_id) {
        wonCount[winner.player_id] = (wonCount[winner.player_id] ?? 0) + 1;
      }
    }
    setGamesWithWinners(withWinners);
    setGamesWonByPlayer(wonCount);
    setLoading(false);
  }, [user, groupId]);

  const handleJoin = useCallback(async () => {
    if (!user || !groupId) return;
    setJoinError(null);
    setJoining(true);
    const supabase = createClient();
    const nameToUse = joinDisplayName.trim() || null;
    if (nameToUse) {
      await supabase.from("players").upsert({ id: user.id, display_name: nameToUse }, { onConflict: "id" });
    }
    const { error: insertErr } = await supabase.from("group_members").insert({
      group_id: groupId,
      player_id: user.id,
      is_anonymous: isAnonymous,
      sort_order: 9999,
    });
    if (insertErr) {
      setJoinError(insertErr.code === "23503" ? "Group not found." : "Could not join group.");
      setJoining(false);
      return;
    }
    setShowJoinForm(false);
    setJoinDisplayName("");
    setJoining(false);
    setLoading(true);
    await fetchGroup();
  }, [user, groupId, joinDisplayName, isAnonymous, fetchGroup]);

  useEffect(() => {
    if (!authLoading && !user) {
      setLoading(false);
      return;
    }
    if (!user) return;
    fetchGroup();
  }, [authLoading, user, groupId, router, fetchGroup]);

  const handleSaveName = async () => {
    if (!group || !user) return;
    setSavingName(true);
    const supabase = createClient();
    await supabase.from("saved_groups").update({ name: groupNameInput.trim() || null }).eq("id", group.id);
    setGroup((prev) => (prev ? { ...prev, name: groupNameInput.trim() || null } : null));
    setSavingName(false);
    setEditingName(false);
  };

  const handleSaveSettings = async () => {
    if (!group || !isOwner) return;
    setSavingSettings(true);
    const supabase = createClient();
    await supabase.from("saved_groups").update({ anyone_can_add_members: anyoneAdd, only_admin_can_remove: onlyAdminRemove, daily_game_enabled: dailyEnabled }).eq("id", group.id);
    setGroup((prev) => (prev ? { ...prev, anyone_can_add_members: anyoneAdd, only_admin_can_remove: onlyAdminRemove, daily_game_enabled: dailyEnabled } : null));
    setSavingSettings(false);
  };

  const handleAddMember = async () => {
    if (!group || !newMemberName.trim()) return;
    const trimmed = newMemberName.trim();
    if (!trimmed.includes("@")) {
      setAddMemberError("Please enter an email address.");
      return;
    }
    setAddingMember(true);
    setAddMemberError(null);
    setAddMemberSuccess(null);
    try {
      const res = await fetch(`/api/groups/${group.id}/invite-by-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAddMemberError(data.error ?? "Failed to invite");
        setAddingMember(false);
        return;
      }
      if (data.added) {
        setAddMemberSuccess("Added to group (account found)");
      } else {
        setAddMemberSuccess(`Invite sent to ${data.email ?? trimmed}`);
      }
      setNewMemberName("");
      setShowAddMember(false);
      await fetchGroup();
    } catch {
      setAddMemberError("Something went wrong");
    }
    setAddingMember(false);
  };

  const handleRemoveMember = async (memberId: string) => {
    const supabase = createClient();
    await supabase.from("group_members").delete().eq("id", memberId);
    setMemberMenuId(null);
    await fetchGroup();
  };

  const handleCancelInvite = async (inviteId: string) => {
    const supabase = createClient();
    await supabase.from("email_invites").delete().eq("id", inviteId);
    await fetchGroup();
  };

  const handleTransferOwnership = async (newOwnerId: string) => {
    if (!group || !isOwner) return;
    const supabase = createClient();
    await supabase.from("saved_groups").update({ owner_id: newOwnerId }).eq("id", group.id);
    setMemberMenuId(null);
    await fetchGroup();
  };

  const handleLeave = async () => {
    if (!user || !group) return;
    setLeaving(true);
    const supabase = createClient();
    const myRow = members.find((m) => m.player_id === user.id);
    if (myRow) {
      await supabase.from("group_members").delete().eq("id", myRow.id);
      if (group.owner_id === user.id) {
        const others = members.filter((m) => m.player_id && m.player_id !== user.id).sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());
        const newOwner = others[0]?.player_id;
        if (newOwner) await supabase.from("saved_groups").update({ owner_id: newOwner }).eq("id", group.id);
      }
    }
    router.push("/profile/groups");
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-secondary">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 font-sans">
        <p className="text-center text-secondary">Sign in to view and join this group.</p>
        <SignInToJoinGroup groupId={groupId} />
        <Link href="/" className="text-splash hover:underline">Back home</Link>
      </div>
    );
  }

  if (showJoinForm) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 font-sans">
        <div className="w-full max-w-lg rounded-xl border border-surface-muted bg-white p-6 flex flex-col gap-4">
          <h1 className="text-xl font-bold text-black">Join this group</h1>
          <p className="text-sm text-secondary">Add yourself with a display name to view the group.</p>
          <input
            type="text"
            value={joinDisplayName}
            onChange={(e) => { setJoinDisplayName(e.target.value); setJoinError(null); }}
            placeholder="Your display name (optional)"
            className="rounded-lg border border-surface-muted bg-surface px-3 py-2 text-sm text-black placeholder:text-secondary"
            disabled={joining}
          />
          {joinError && <p className="text-sm text-red-600">{joinError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleJoin}
              disabled={joining}
              className="rounded-lg bg-splash text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {joining ? "Joining…" : "Join group"}
            </button>
            <Link href="/" className="rounded-lg border border-surface-muted bg-surface px-4 py-2 text-sm font-medium text-black hover:bg-surface-muted">Cancel</Link>
          </div>
        </div>
        <Link href="/profile/groups" className="text-splash hover:underline">← Groups</Link>
      </div>
    );
  }

  if (notFound || (!loading && !group)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-center text-secondary">Group not found.</p>
        <Link href="/profile/groups" className="text-splash hover:underline">Back to groups</Link>
      </div>
    );
  }

  if (loading || !group) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-secondary">Loading...</p>
      </div>
    );
  }

  const streak = getGroupStreak(gamesWithWinners.map((g) => g.game), group.id);

  const groupLink = typeof window !== "undefined" ? `${window.location.origin}/groups/${groupId}` : "";
  const copyGroupLink = () => {
    if (!groupLink) return;
    navigator.clipboard.writeText(groupLink).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-12 font-sans">
      <main className="w-full max-w-lg flex flex-col items-center gap-8">
        <div className="w-full rounded-xl border border-surface-muted bg-white p-6 flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <Link href="/profile/groups" className="text-sm text-secondary hover:text-splash">← Groups</Link>
          </div>

          {editingName ? (
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={groupNameInput}
                onChange={(e) => setGroupNameInput(e.target.value)}
                className="flex-1 rounded-lg border border-surface-muted bg-surface px-3 py-2 text-sm text-black placeholder:text-secondary"
                placeholder="Group name"
              />
              <button onClick={handleSaveName} disabled={savingName} className="rounded-lg bg-splash text-white px-4 py-2 text-sm font-medium">Save</button>
              <button onClick={() => { setEditingName(false); setGroupNameInput(group.name ?? ""); }} className="rounded-lg border border-surface-muted bg-surface px-4 py-2 text-sm font-medium text-black hover:bg-surface-muted">Cancel</button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-2xl font-bold tracking-tight text-black truncate">{groupDisplayName}</h1>
              <button onClick={() => setEditingName(true)} className="shrink-0 text-sm font-medium text-splash hover:underline">Edit name</button>
            </div>
          )}

          {streak > 0 && (
            <p className="text-sm text-splash">{streak}-day streak</p>
          )}

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-black">Games</h2>
              <Link
                href={`/create?group=${encodeURIComponent(group.id)}`}
                className="flex items-center gap-1 rounded-lg bg-splash text-white px-4 py-2 text-sm font-medium hover:opacity-90"
              >
                <PlusIcon className="h-4 w-4" /> New game
              </Link>
            </div>
            <div className="overflow-x-auto overflow-y-hidden pb-2 -mx-2 w-full">
              <div className="flex flex-col gap-3 min-w-max w-max">
                <div className="flex gap-3">
                  {gamesWithWinners.filter((_, i) => i % 2 === 0).map(({ game }) => (
                    <Link
                      key={game.id}
                      href={`/play/${game.invite_code}`}
                      className="flex shrink-0 w-32 flex-col rounded-lg border border-surface-muted bg-surface text-black hover:bg-surface-muted transition-colors overflow-hidden"
                    >
                      <div className="w-32 h-32 p-1.5">
                        <GameGridPreview
                          axisXLow={game.axis_x_label_low}
                          axisXHigh={game.axis_x_label_high}
                          axisYLow={game.axis_y_label_low}
                          axisYHigh={game.axis_y_label_high}
                          selfPosition={null}
                          otherPositions={[]}
                        />
                      </div>
                      <div className="text-[10px] text-secondary text-center px-1 pb-1 truncate">
                        {new Date(game.created_at).toLocaleDateString()}
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="flex gap-3">
                  {gamesWithWinners.filter((_, i) => i % 2 === 1).map(({ game }) => (
                    <Link
                      key={game.id}
                      href={`/play/${game.invite_code}`}
                      className="flex shrink-0 w-32 flex-col rounded-lg border border-surface-muted bg-surface text-black hover:bg-surface-muted transition-colors overflow-hidden"
                    >
                      <div className="w-32 h-32 p-1.5">
                        <GameGridPreview
                          axisXLow={game.axis_x_label_low}
                          axisXHigh={game.axis_x_label_high}
                          axisYLow={game.axis_y_label_low}
                          axisYHigh={game.axis_y_label_high}
                          selfPosition={null}
                          otherPositions={[]}
                        />
                      </div>
                      <div className="text-[10px] text-secondary text-center px-1 pb-1 truncate">
                        {new Date(game.created_at).toLocaleDateString()}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-black">Members</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyGroupLink}
                  className="text-sm font-medium text-splash hover:underline shrink-0"
                >
                  {linkCopied ? "Copied!" : "Copy group link"}
                </button>
                {canAddMembers && (
                  <button onClick={() => setShowAddMember(true)} className="flex items-center gap-1 text-sm font-medium text-splash hover:underline">
                    <PlusIcon className="h-4 w-4" /> Add
                  </button>
                )}
              </div>
            </div>
            {showAddMember && (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={newMemberName}
                    onChange={(e) => { setNewMemberName(e.target.value); setAddMemberError(null); setAddMemberSuccess(null); }}
                    placeholder="Email"
                    className="flex-1 rounded-lg border border-surface-muted bg-surface px-3 py-2 text-sm text-black placeholder:text-secondary"
                  />
                  <button onClick={handleAddMember} disabled={addingMember || !newMemberName.trim()} className="rounded-lg bg-splash text-white px-4 py-2 text-sm font-medium">Invite</button>
                  <button onClick={() => { setShowAddMember(false); setNewMemberName(""); setAddMemberError(null); setAddMemberSuccess(null); }} className="rounded-lg border border-surface-muted bg-surface px-4 py-2 text-sm font-medium text-black hover:bg-surface-muted">Cancel</button>
                </div>
                {addMemberError && <p className="text-sm text-red-600">{addMemberError}</p>}
                {addMemberSuccess && <p className="text-sm text-green-600">{addMemberSuccess}</p>}
              </div>
            )}
            <ul className="space-y-2">
              {members.map((m) => {
                return (
                  <li key={m.id} className="flex flex-col gap-1.5 rounded-lg border border-surface-muted bg-surface p-3 text-black">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {group.owner_id === m.player_id && <CrownIcon className="h-5 w-5 shrink-0 text-amber-500" />}
                        {m.is_anonymous && <IncognitoIcon className="h-4 w-4 shrink-0 text-secondary" />}
                        {m.player_id && (
                          <span className="shrink-0 rounded bg-splash/15 px-1.5 py-0.5 text-xs font-medium text-splash" title="Linked account">Account</span>
                        )}
                        <span className="font-medium truncate">{getMemberDisplayName(m)}</span>
                        <span className="text-xs text-secondary shrink-0">{m.player_id ? (gamesWonByPlayer[m.player_id] ?? 0) : 0} wins</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {canRemoveMembers && m.player_id !== user?.id && (
                          <div className="relative">
                            <button onClick={() => setMemberMenuId(memberMenuId === m.id ? null : m.id)} className="p-1 rounded text-secondary hover:bg-surface-muted">⋯</button>
                            {memberMenuId === m.id && (
                              <div className="absolute right-0 top-full mt-1 z-10 rounded-lg border border-surface-muted bg-white shadow-lg py-1 min-w-[140px]">
                                <button onClick={() => { handleRemoveMember(m.id); }} className="block w-full text-left px-3 py-1.5 text-sm text-black hover:bg-surface-muted">Remove</button>
                                {isOwner && m.player_id && (
                                  <button onClick={() => { handleTransferOwnership(m.player_id!); }} className="block w-full text-left px-3 py-1.5 text-sm text-black hover:bg-surface-muted">Transfer ownership</button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {m.player_id && ((memberFeaturedTags[m.player_id]?.length ?? 0) > 0) && (
                      <div className="flex flex-wrap gap-1.5">
                        {memberFeaturedTags[m.player_id].map((t, i) => (
                          <span key={`${m.player_id}-${t.label}-${i}`} className="inline-flex rounded-full bg-surface-muted/80 border border-surface-muted px-2.5 py-0.5 text-xs text-black">
                            {t.label} {t.agreement_pct}%
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {pendingInvites.length > 0 && (
              <div className="mt-3 rounded-lg border border-dashed border-surface-muted bg-surface/50 p-3">
                <p className="text-sm font-medium text-black mb-2">Pending invites</p>
                <ul className="space-y-1.5">
                  {pendingInvites.map((inv) => (
                    <li key={inv.id} className="flex items-center justify-between gap-2 text-sm text-secondary">
                      <span>Invite sent to <span className="text-black">{inv.masked_email}</span> (pending)</span>
                      {inv.invited_by === user?.id && (
                        <button type="button" onClick={() => handleCancelInvite(inv.id)} className="text-red-600 hover:underline text-xs">Cancel</button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {isOwner && (
            <section className="rounded-lg border border-surface-muted bg-surface p-4 flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-black">Group settings</h2>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={anyoneAdd} onChange={(e) => setAnyoneAdd(e.target.checked)} className="rounded border-surface-muted" />
                <span className="text-sm text-black">Anyone can add members</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={onlyAdminRemove} onChange={(e) => setOnlyAdminRemove(e.target.checked)} className="rounded border-surface-muted" />
                <span className="text-sm text-black">Only admin can remove members</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={dailyEnabled} onChange={(e) => setDailyEnabled(e.target.checked)} className="rounded border-surface-muted" />
                <span className="text-sm text-black">Daily game email reminders</span>
              </label>
              <button onClick={handleSaveSettings} disabled={savingSettings} className="rounded-lg bg-splash text-white px-4 py-2 text-sm font-medium w-fit">Save settings</button>
            </section>
          )}

          <section>
            <button onClick={handleLeave} disabled={leaving} className="rounded-lg border border-surface-muted bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
              {leaving ? "Leaving…" : "Leave group"}
            </button>
          </section>
        </div>
      </main>
    </div>
  );
}

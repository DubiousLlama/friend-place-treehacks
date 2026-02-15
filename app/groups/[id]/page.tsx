"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { getGroupStreak } from "@/lib/streak-utils";
import type { Database } from "@/lib/types/database";

type SavedGroup = Database["public"]["Tables"]["saved_groups"]["Row"];
type GroupMember = Database["public"]["Tables"]["group_members"]["Row"];
type Game = Database["public"]["Tables"]["games"]["Row"];
type GamePlayer = Database["public"]["Tables"]["game_players"]["Row"];

interface GameWithWinner {
  game: Game;
  winnerDisplayName: string;
  winnerInitials: string;
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

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.6 1.5 4.8 3.7 5.7-.5.4-.9 1.1-.9 1.8v2c0 1.1.9 2 2 2h4c1.1 0 2-.9 2-2v-2c0-.7-.4-1.4-.9-1.8 2.2-.9 3.7-3.1 3.7-5.7V7c0-1.1-.9-2-2-2zM5 8V7h2v3.8c0 1.2-.6 2.3-1.6 2.9V8zm14 0v5.7c-1-.6-1.6-1.7-1.6-2.9V7h2v1zm-6 10v2h-2v-2h2z" />
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

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading, isLinked } = useAuth();
  const groupId = params.id as string;
  const [group, setGroup] = useState<SavedGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [gamesWithWinners, setGamesWithWinners] = useState<GameWithWinner[]>([]);
  const [gamesWonByPlayer, setGamesWonByPlayer] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
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

  const isOwner = user && group && group.owner_id === user.id;
  const myMember = members.find((m) => m.player_id === user?.id);
  const canAddMembers = isOwner || (group?.anyone_can_add_members && myMember);
  const canRemoveMembers = isOwner || !group?.only_admin_can_remove;

  const groupDisplayName = group?.name && group.name.trim() !== "" ? group.name : members.map((m) => m.display_name).join(", ");

  const fetchGroup = useCallback(async () => {
    if (!user || !isLinked || !groupId) return;
    const supabase = createClient();
    const { data: g, error: ge } = await supabase.from("saved_groups").select("*").eq("id", groupId).single();
    if (ge || !g) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const { data: mems } = await supabase.from("group_members").select("*").eq("group_id", groupId).order("sort_order", { ascending: true });
    const memberList = (mems ?? []) as GroupMember[];
    const isMember = g.owner_id === user.id || memberList.some((m) => m.player_id === user.id);
    if (!isMember) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setGroup(g as SavedGroup);
    setMembers(memberList);
    setGroupNameInput(g.name ?? "");
    setDailyEnabled(g.daily_game_enabled);
    setAnyoneAdd(g.anyone_can_add_members);
    setOnlyAdminRemove(g.only_admin_can_remove);

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
  }, [user, isLinked, groupId]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/");
      return;
    }
    if (!user || !isLinked) return;
    fetchGroup();
  }, [authLoading, user, isLinked, groupId, router, fetchGroup]);

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
    setAddingMember(true);
    const supabase = createClient();
    const maxOrder = members.length ? Math.max(...members.map((m) => m.sort_order)) : -1;
    await supabase.from("group_members").insert({ group_id: group.id, display_name: newMemberName.trim(), is_anonymous: true, player_id: null, sort_order: maxOrder + 1 });
    setNewMemberName("");
    setShowAddMember(false);
    await fetchGroup();
    setAddingMember(false);
  };

  const handleRemoveMember = async (memberId: string) => {
    const supabase = createClient();
    await supabase.from("group_members").delete().eq("id", memberId);
    setMemberMenuId(null);
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

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-secondary">Loading...</p>
      </div>
    );
  }

  if (!isLinked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-center text-secondary">Sign in to view groups.</p>
        <Link href="/" className="text-splash hover:underline">Back home</Link>
      </div>
    );
  }

  if (notFound || (!loading && !group)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-center text-secondary">Group not found or you’re not a member.</p>
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
            <button
              type="button"
              onClick={copyGroupLink}
              className="text-sm font-medium text-splash hover:underline shrink-0"
            >
              {linkCopied ? "Copied!" : "Copy group link"}
            </button>
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
            <h2 className="text-lg font-semibold text-black">Games</h2>
            <div className="overflow-x-auto pb-2 -mx-2 w-full flex justify-center">
              <div className="flex flex-col gap-3 min-w-max w-max">
                <div className="flex gap-3">
                  {gamesWithWinners.filter((_, i) => i % 2 === 0).map(({ game, winnerDisplayName, winnerInitials }) => (
                    <Link key={game.id} href={`/play/${game.invite_code}`} className="block w-44 shrink-0 rounded-lg border border-surface-muted bg-surface p-3 text-black hover:bg-surface-muted transition-colors relative" title={winnerDisplayName}>
                  <div className="absolute top-2 right-2 text-xs text-secondary">{new Date(game.created_at).toLocaleDateString()}</div>
                  <div className="flex items-center justify-center mt-4">
                    <span className="relative flex h-12 w-12 items-center justify-center text-amber-800 text-xs font-bold">
                      <TrophyIcon className="absolute inset-0 h-12 w-12 text-amber-400/90" />
                      <span className="relative z-10">{winnerInitials}</span>
                    </span>
                  </div>
                  <div className="text-xs text-secondary mt-2 truncate">{game.axis_x_label_low}–{game.axis_x_label_high}</div>
                </Link>
              ))}
            </div>
                <div className="flex gap-3">
                  {gamesWithWinners.filter((_, i) => i % 2 === 1).map(({ game, winnerDisplayName, winnerInitials }) => (
                    <Link key={game.id} href={`/play/${game.invite_code}`} className="block w-44 shrink-0 rounded-lg border border-surface-muted bg-surface p-3 text-black hover:bg-surface-muted transition-colors relative" title={winnerDisplayName}>
                  <div className="absolute top-2 right-2 text-xs text-secondary">{new Date(game.created_at).toLocaleDateString()}</div>
                  <div className="flex items-center justify-center mt-4">
                    <span className="relative flex h-12 w-12 items-center justify-center text-amber-800 text-xs font-bold">
                      <TrophyIcon className="absolute inset-0 h-12 w-12 text-amber-400/90" />
                      <span className="relative z-10">{winnerInitials}</span>
                    </span>
                  </div>
                  <div className="text-xs text-secondary mt-2 truncate">{game.axis_x_label_low}–{game.axis_x_label_high}</div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-black">Members</h2>
              {canAddMembers && (
                <button onClick={() => setShowAddMember(true)} className="flex items-center gap-1 text-sm font-medium text-splash hover:underline">
                  <PlusIcon className="h-4 w-4" /> Add
                </button>
              )}
            </div>
            {showAddMember && (
              <div className="flex gap-2">
                <input value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} placeholder="Display name" className="flex-1 rounded-lg border border-surface-muted bg-surface px-3 py-2 text-sm text-black placeholder:text-secondary" />
                <button onClick={handleAddMember} disabled={addingMember || !newMemberName.trim()} className="rounded-lg bg-splash text-white px-4 py-2 text-sm font-medium">Add</button>
                <button onClick={() => { setShowAddMember(false); setNewMemberName(""); }} className="rounded-lg border border-surface-muted bg-surface px-4 py-2 text-sm font-medium text-black hover:bg-surface-muted">Cancel</button>
              </div>
            )}
            <ul className="space-y-2">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-surface-muted bg-surface p-3 text-black">
                <div className="flex items-center gap-2 min-w-0">
                  {group.owner_id === m.player_id && <CrownIcon className="h-5 w-5 shrink-0 text-amber-500" />}
                  {m.is_anonymous && <IncognitoIcon className="h-4 w-4 shrink-0 text-secondary" />}
                  <span className="font-medium truncate">{m.display_name}</span>
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
              </li>
              ))}
            </ul>
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

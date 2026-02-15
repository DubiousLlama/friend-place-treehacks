"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/use-auth";
import type { Database } from "@/lib/types/database";

type SavedGroup = Database["public"]["Tables"]["saved_groups"]["Row"];
type GroupMember = Database["public"]["Tables"]["group_members"]["Row"];

interface GroupWithMembers {
  group: SavedGroup;
  members: GroupMember[];
}

function getGroupDisplayName(g: GroupWithMembers): string {
  if (g.group.name && g.group.name.trim() !== "") return g.group.name;
  return g.members.map((m) => m.display_name).join(", ");
}

export default function ProfileGroupsPage() {
  const { user, loading: authLoading, isLinked } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [leavingId, setLeavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/");
      return;
    }
    if (!user || !isLinked) return;

    const run = async () => {
      const supabase = createClient();
      const { data: memberRows } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("player_id", user.id);
      const groupIds = [...new Set((memberRows ?? []).map((r) => r.group_id))];
      if (groupIds.length === 0) {
        setGroups([]);
        setLoading(false);
        return;
      }
      const { data: groupData } = await supabase
        .from("saved_groups")
        .select("*")
        .in("id", groupIds);
      const { data: allMembers } = await supabase
        .from("group_members")
        .select("*")
        .in("group_id", groupIds)
        .order("sort_order", { ascending: true });
      const membersByGroup = new Map<string, GroupMember[]>();
      for (const m of allMembers ?? []) {
        const list = membersByGroup.get(m.group_id) ?? [];
        list.push(m);
        membersByGroup.set(m.group_id, list);
      }
      const withMembers: GroupWithMembers[] = (groupData ?? []).map((group) => ({
        group,
        members: membersByGroup.get(group.id) ?? [],
      }));
      setGroups(withMembers);
      setLoading(false);
    };

    run();
  }, [user, authLoading, isLinked, router]);

  const handleLeave = async (groupId: string) => {
    if (!user) return;
    setLeavingId(groupId);
    const supabase = createClient();
    const { data: myMember } = await supabase
      .from("group_members")
      .select("id")
      .eq("group_id", groupId)
      .eq("player_id", user.id)
      .single();
    if (myMember) {
      await supabase.from("group_members").delete().eq("id", myMember.id);
      const { data: group } = await supabase.from("saved_groups").select("owner_id").eq("id", groupId).single();
      if (group?.owner_id === user.id) {
        const { data: others } = await supabase
          .from("group_members")
          .select("player_id, joined_at")
          .eq("group_id", groupId)
          .not("player_id", "is", null)
          .order("joined_at", { ascending: true });
        const newOwner = others?.[0]?.player_id;
        if (newOwner) {
          await supabase.from("saved_groups").update({ owner_id: newOwner }).eq("id", groupId);
        }
      }
      setGroups((prev) => prev.filter((g) => g.group.id !== groupId));
    }
    setLeavingId(null);
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
        <p className="text-center text-secondary">Sign in to see your groups.</p>
        <Link href="/" className="text-splash hover:underline">Back home</Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-12 font-sans">
      <main className="w-full max-w-lg flex flex-col items-center gap-8">
        {loading ? (
          <p className="text-secondary">Loading...</p>
        ) : (
          <div className="w-full rounded-xl border border-surface-muted bg-white p-6 flex flex-col gap-6">
            <div className="flex flex-col gap-2 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-black">
                Groups
              </h1>
      <p className="text-sm text-secondary mb-6">
        Groups you’re in. You can leave a group or open it to see games and members.
              </p>
            </div>

            {groups.length === 0 ? (
        <p className="text-secondary">
          You’re not in any groups yet. Save a group from a game result or get invited.
              </p>
            ) : (
              <ul className="space-y-2">
                {groups.map((g) => (
            <li
              key={g.group.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-surface-muted bg-surface p-3 text-black hover:bg-surface-muted transition-colors"
            >
              <Link
                href={`/groups/${g.group.id}`}
                className="flex-1 min-w-0 font-medium truncate hover:text-splash"
              >
                {getGroupDisplayName(g)}
              </Link>
              <button
                type="button"
                onClick={() => handleLeave(g.group.id)}
                disabled={leavingId === g.group.id}
                className="shrink-0 rounded-lg border border-surface-muted bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-surface-muted disabled:opacity-50 transition-colors"
              >
                {leavingId === g.group.id ? "Leaving…" : "Leave"}
              </button>
            </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

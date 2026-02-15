"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/use-auth";

/**
 * When user is signed in and linked but has no players.display_name,
 * redirect to /profile/set-name (unless already there).
 */
export function DisplayNameChecker() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading, isLinked } = useAuth();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (authLoading || !user || !isLinked || pathname === "/profile/set-name") {
      setChecked(true);
      return;
    }

    const run = async () => {
      try {
        const justSet = sessionStorage.getItem("fp-just-set-display-name");
        if (justSet) {
          sessionStorage.removeItem("fp-just-set-display-name");
          setChecked(true);
          return;
        }
      } catch {
        /* ignore */
      }

      const supabase = createClient();
      const { data: player, error: playerError } = await supabase
        .from("players")
        .select("display_name")
        .eq("id", user.id)
        .single();

      const hasName =
        player?.display_name != null && String(player.display_name).trim() !== "";
      if (!hasName) {
        router.replace("/profile/set-name");
      }
      setChecked(true);
    };

    run();
  }, [authLoading, user, isLinked, pathname, router]);

  return null;
}

"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    const get = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      setUser(u ?? null);
      setLoading(false);
    };
    get();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const isAnonymous =
    user?.is_anonymous === true ||
    (user?.app_metadata?.provider === "anonymous");
  const isLinked = !!user && !isAnonymous;

  return { user, loading, isAnonymous, isLinked };
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/use-auth";

export function AppNav() {
  const router = useRouter();
  const { user, loading, isLinked } = useAuth();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    window.location.href = "/";
  };

  return (
    <>
      <nav className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-surface/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="font-display text-lg font-semibold text-foreground no-underline hover:text-splash"
          >
            Friend Place
          </Link>
          {!loading && isLinked && (
            <>
              <Link
                href="/games"
                className="text-sm text-secondary hover:text-foreground"
              >
                My games
              </Link>
              <Link
                href="/profile"
                className="text-sm text-secondary hover:text-foreground"
              >
                Profile
              </Link>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!loading && user && isLinked && (
            <>
              <span className="text-sm text-secondary truncate max-w-[140px]">
                {user.email ?? "Signed in"}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-sm text-secondary hover:text-foreground"
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </nav>
    </>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/use-auth";

function AccountIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}

export function AppNav() {
  const router = useRouter();
  const { user, loading, isLinked } = useAuth();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    window.location.href = "/";
  };

  const accountLabel = user?.email ?? "Signed in";

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
              <Link
                href="/profile"
                className="flex items-center gap-1.5 rounded p-1.5 text-secondary hover:bg-muted hover:text-foreground"
                title="Account"
                aria-label="Account"
              >
                <AccountIcon className="h-5 w-5" />
              </Link>
              <span className="text-sm text-secondary truncate max-w-[160px]">
                {accountLabel}
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

"use client";

import Link from "next/link";
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

function DieIcon({ className }: { className?: string }) {
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
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <circle cx="9" cy="9" r="1" fill="currentColor" />
      <circle cx="15" cy="15" r="1" fill="currentColor" />
      <circle cx="9" cy="15" r="1" fill="currentColor" />
      <circle cx="15" cy="9" r="1" fill="currentColor" />
    </svg>
  );
}

function GroupsIcon({ className }: { className?: string }) {
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
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function AppNav() {
  const { user, loading, isLinked } = useAuth();

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
                className="flex items-center gap-1.5 text-sm text-secondary hover:text-foreground"
                title="My games"
                aria-label="My games"
              >
                <DieIcon className="h-4 w-4" />
                My games
              </Link>
              <Link
                href="/profile/groups"
                className="flex items-center gap-1.5 text-sm text-secondary hover:text-foreground"
                title="Groups"
                aria-label="Groups"
              >
                <GroupsIcon className="h-4 w-4" />
                Groups
              </Link>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!loading && user && (
            <>
              <Link
                href="/profile"
                className="flex items-center gap-1.5 rounded px-2 py-1.5 text-sm text-secondary hover:bg-muted hover:text-foreground"
                title="Me"
                aria-label="Me"
              >
                <AccountIcon className="h-5 w-5 shrink-0" />
                Me
              </Link>
            </>
          )}
        </div>
      </nav>
    </>
  );
}

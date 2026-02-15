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

export function AppNav() {
  const { user, loading, isLinked } = useAuth();

  return (
    <>
      <nav className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-surface/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="flex items-center min-w-0 w-1/3 justify-start" />
        <div className="flex items-center justify-center shrink-0">
          <Link
            href="/"
            className="font-display text-lg font-bold text-foreground no-underline hover:text-splash"
          >
            Friend Place
          </Link>
        </div>
        <div className="flex items-center gap-2 min-w-0 w-1/3 justify-end">
          {!loading && user && isLinked && (
            <Link
              href="/profile"
              className="flex items-center gap-1.5 rounded p-1.5 text-secondary hover:bg-muted hover:text-foreground"
              title="Account"
              aria-label="Account"
            >
              <AccountIcon className="h-5 w-5" />
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}

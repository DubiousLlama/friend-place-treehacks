"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CreateGameForm } from "@/components/CreateGameForm";

function CreatePageContent() {
  const searchParams = useSearchParams();
  const groupId = searchParams.get("group");

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-12 font-sans">
      <main className="w-full max-w-lg flex flex-col gap-6">
        <Link
          href={groupId ? `/groups/${groupId}` : "/profile"}
          className="text-sm text-secondary hover:text-splash"
        >
          ← {groupId ? "Back to group" : "Back to profile"}
        </Link>
        <CreateGameForm initialGroupId={groupId ?? undefined} />
      </main>
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-secondary">Loading…</div>}>
      <CreatePageContent />
    </Suspense>
  );
}

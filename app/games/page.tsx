"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GamesPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/profile");
  }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-secondary">Redirecting...</p>
    </div>
  );
}

"use client";

import { CreateGameForm } from "@/components/CreateGameForm";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-12 font-sans">
      <main className="w-full max-w-lg flex flex-col items-center gap-8">
        <div className="flex flex-col gap-3 text-center">
          <p className="text-secondary">
            Place yourself on the chart, then guess where your friends placed themselves.
            Share the link and see who knows each other best.
          </p>
        </div>
        <CreateGameForm />
      </main>
    </div>
  );
}

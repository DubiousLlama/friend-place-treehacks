"use client";

import { useState, useEffect } from "react";
import { CreateGameForm } from "@/components/CreateGameForm";
import { SampleAxisPreview } from "@/components/SampleAxisPreview";

interface AxisSuggestion {
  x_low: string;
  x_high: string;
  y_low: string;
  y_high: string;
}

/** Default axes so the sample chart always shows (before daily API loads or if it fails). */
const DEFAULT_SAMPLE_AXES: AxisSuggestion = {
  x_low: "Morning person",
  x_high: "Night owl",
  y_low: "Chaos",
  y_high: "Order",
};

export default function Home() {
  const [dailyAxes, setDailyAxes] = useState<AxisSuggestion | null>(null);
  const [loadingAxes, setLoadingAxes] = useState(true);

  useEffect(() => {
    fetch("/api/ai/daily-axis")
      .then((res) => res.json())
      .then((data: AxisSuggestion) => {
        if (data?.x_low != null && data?.x_high != null && data?.y_low != null && data?.y_high != null) {
          setDailyAxes(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingAxes(false));
  }, []);

  const scrollToCreateGame = () => {
    document.getElementById("create-game")?.scrollIntoView({ behavior: "smooth" });
  };

  const axesToShow = dailyAxes ?? DEFAULT_SAMPLE_AXES;

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-12 font-sans">
      <main className="w-full max-w-lg flex flex-col items-center gap-8">
        <div className="flex flex-col gap-3 text-center">
          <p className="text-secondary">
            Place yourself on the chart, then guess where your friends placed themselves.
            Share the link and see who knows each other best.
          </p>
        </div>

        <button
          type="button"
          onClick={scrollToCreateGame}
          className="w-full flex flex-col items-center gap-2 text-left hover:opacity-90 active:opacity-95 transition-opacity cursor-pointer"
          aria-label="Today's axes — tap to create a game"
        >
          <span className="text-sm font-medium text-black">
            {loadingAxes ? "Loading today's axes…" : "Today's axes"}
          </span>
          <SampleAxisPreview
            axisXLow={axesToShow.x_low}
            axisXHigh={axesToShow.x_high}
            axisYLow={axesToShow.y_low}
            axisYHigh={axesToShow.y_high}
          />
          <span className="text-xs text-secondary">
            Tap to create a game
          </span>
        </button>

        <div id="create-game" className="w-full scroll-mt-8">
          <CreateGameForm initialDailyAxes={dailyAxes} />
        </div>
      </main>
    </div>
  );
}

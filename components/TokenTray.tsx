"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { NamePlacement, Position } from "@/lib/game-types";
import { PlayerToken } from "@/components/PlayerToken";
import { staggerContainer, staggerItem } from "@/lib/motion";

interface TokenTrayProps {
  friends: NamePlacement[];
  onPlace: (gamePlayerId: string, pos: Position) => void;
  onRemove: (gamePlayerId: string) => void;
  graphRef: React.RefObject<HTMLDivElement | null>;
}

export function TokenTray({
  friends,
  onPlace,
  onRemove,
  graphRef,
}: TokenTrayProps) {
  const unplaced = friends.filter((n) => n.position === null);
  const allPlaced = unplaced.length === 0;

  return (
    <AnimatePresence mode="wait">
      {allPlaced ? (
        <motion.div
          key="all-placed"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="flex items-center justify-center px-4 py-3 bg-surface border-t border-secondary/10"
        >
          <span className="font-body text-sm text-secondary">
            All placed! Ready to submit
          </span>
        </motion.div>
      ) : (
        <motion.div
          key="tray"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="bg-surface border-t border-secondary/10 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]"
        >
          <motion.div
            className="flex gap-3 px-4 py-3 flex-wrap justify-center"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {unplaced.map((entry) => (
              <motion.div key={entry.gamePlayer.id} variants={staggerItem}>
                <PlayerToken
                  id={entry.gamePlayer.id}
                  label={entry.gamePlayer.display_name}
                  variant="friend"
                  position={null}
                  onPlace={(pos) => onPlace(entry.gamePlayer.id, pos)}
                  onRemove={() => onRemove(entry.gamePlayer.id)}
                  graphRef={graphRef}
                />
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

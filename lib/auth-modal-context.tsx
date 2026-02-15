"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AuthModal } from "@/components/AuthModal";

type AuthModalContextValue = {
  openAuthModal: () => void;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const openAuthModal = useCallback(() => {
    setOpen(true);
  }, []);

  return (
    <AuthModalContext.Provider value={{ openAuthModal }}>
      {children}
      {open && (
        <AuthModal
          onClose={() => setOpen(false)}
          onSuccess={() => setOpen(false)}
        />
      )}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal(): AuthModalContextValue {
  const ctx = useContext(AuthModalContext);
  if (!ctx) {
    throw new Error("useAuthModal must be used within AuthModalProvider");
  }
  return ctx;
}

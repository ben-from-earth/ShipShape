"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { isDemoData } from "@/config/demo";
import type { Engineer } from "@/schemas";

import { AuthApiError, fetchCurrentEngineer } from "./client";
import { signInPath } from "./return-path";

const EngineerContext = createContext<Engineer | null>(null);

export function useEngineer(): Engineer | null {
  return useContext(EngineerContext);
}

function isPublicPath(pathname: string): boolean {
  return pathname === "/sign-in" || pathname.startsWith("/sign-in/");
}

/**
 * Loads the session engineer and sends an expired session to sign-in.
 * A missing cookie is redirected by the proxy before this renders.
 * Demo mode stays on its fixture pages without a session.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const skip = isDemoData() || isPublicPath(pathname);
  const [engineer, setEngineer] = useState<Engineer | null>(null);

  useEffect(() => {
    if (skip) {
      return;
    }
    let cancel = false;
    void fetchCurrentEngineer()
      .then((next) => {
        if (!cancel) {
          setEngineer(next);
        }
      })
      .catch((error: unknown) => {
        if (cancel) {
          return;
        }
        if (error instanceof AuthApiError && error.status === 401) {
          window.location.assign(
            signInPath(window.location.pathname + window.location.search),
          );
        }
      });
    return () => {
      cancel = true;
    };
  }, [skip]);

  return <EngineerContext value={engineer}>{children}</EngineerContext>;
}

"use client";

import { useState, type FormEvent } from "react";

import { Wordmark } from "@/components/shell/wordmark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { AuthApiError, signIn } from "@/features/auth/client";
import { safeReturnPath } from "@/features/auth/return-path";

const inputClass =
  "min-h-11 w-full border border-line-strong bg-surface px-3 py-2 text-base text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

export function SignInForm({ next }: { next: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await signIn({ email, password });
      window.location.assign(safeReturnPath(next));
    } catch (caught) {
      setError(
        caught instanceof AuthApiError ? caught.message : "Could not sign in.",
      );
      setPending(false);
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <Wordmark href="/sign-in" />
      <div className="flex flex-col gap-1.5">
        <Eyebrow>Account</Eyebrow>
        <h1 className="text-h1 font-semibold">Sign in</h1>
      </div>
      <Card className="flex flex-col gap-4 bg-paper-raised p-4 sm:p-6">
        <form
          className="flex flex-col gap-4"
          method="post"
          onSubmit={(event) => void onSubmit(event)}
        >
          <label
            className="flex flex-col gap-1 text-ui font-medium"
            htmlFor="email"
          >
            Email
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              className={inputClass}
              onChange={(event) => {
                setEmail(event.target.value);
              }}
            />
          </label>
          <label
            className="flex flex-col gap-1 text-ui font-medium"
            htmlFor="password"
          >
            Password
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              className={inputClass}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
            />
          </label>
          {error ? (
            <p className="text-body text-accent" role="status">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="min-h-11" disabled={pending}>
            Sign in
          </Button>
        </form>
      </Card>
    </div>
  );
}

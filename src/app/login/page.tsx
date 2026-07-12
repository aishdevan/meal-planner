"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChefHat } from "lucide-react";
import { api, ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", { method: "POST", json: { passcode } });
      router.replace("/");
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "That's not the family passcode."
          : "Something went wrong — try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[75vh] flex-col items-center justify-center gap-7">
      <div className="text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-gradient-to-br from-accent to-terra text-on-accent shadow-lg">
          <ChefHat size={40} />
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">
          Devan Family Meals
        </h1>
        <p className="mt-1.5 text-sm text-soft">
          Enter the household passcode once on this phone.
        </p>
      </div>
      <form onSubmit={submit} className="w-full max-w-xs space-y-3">
        <input
          type="password"
          inputMode="text"
          autoFocus
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Household passcode"
          className="input w-full py-3.5 text-center text-lg"
        />
        {error && <p className="text-center text-sm text-bad">{error}</p>}
        <button
          type="submit"
          disabled={busy || !passcode}
          className="btn-primary w-full py-3.5 text-lg disabled:opacity-50"
        >
          {busy ? "Checking…" : "Let's cook"}
        </button>
      </form>
    </div>
  );
}

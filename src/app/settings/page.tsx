"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Baby,
  Bell,
  Check,
  ChevronLeft,
  Drumstick,
  Leaf,
  Luggage,
  Smartphone,
  Sparkles,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  currentSubscription,
  pushSupport,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-client";
import type { Absence, Member } from "@/lib/types";

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () =>
      api<{
        shortcutToken: string | null;
        bookmarksEndpoint: string;
        claudeConfigured: boolean;
        vapidPublicKey: string | null;
      }>("/api/settings"),
    refetchInterval: false,
  });
  const { data: absencesData } = useQuery({
    queryKey: ["absences"],
    queryFn: () =>
      api<{ absences: Absence[]; members: Member[] }>("/api/absences"),
  });

  const removeAbsence = useMutation({
    mutationFn: (id: string) => api(`/api/absences/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["absences"] });
      qc.invalidateQueries({ queryKey: ["plan"] });
    },
  });

  const memberName = new Map(
    (absencesData?.members ?? []).map((m) => [m.id, m.name]),
  );

  return (
    <div className="space-y-4">
      <header className="pt-3">
        <Link
          href="/recipes"
          className="inline-flex items-center gap-0.5 text-sm text-faint"
        >
          <ChevronLeft size={15} /> Back
        </Link>
        <h1 className="mt-1 text-[28px] font-bold tracking-tight">Settings</h1>
      </header>

      <section className="card p-4">
        <h2 className="font-bold tracking-tight">Household</h2>
        <ul className="mt-2.5 space-y-2 text-sm">
          {(absencesData?.members ?? []).map((m) => (
            <li key={m.id} className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5">
                {m.name}
                {m.isChild && <Baby size={14} className="text-terra" />}
              </span>
              <span
                className={`chip font-medium ${
                  m.diet === "vegetarian"
                    ? "bg-good-soft text-good"
                    : "bg-terra-soft text-terra"
                }`}
              >
                {m.diet === "vegetarian" ? (
                  <>
                    <Leaf size={11} /> vegetarian
                  </>
                ) : (
                  <>
                    <Drumstick size={11} /> omnivore
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-faint">
          <Sparkles size={12} />
          AI planning:{" "}
          {settings?.claudeConfigured ? (
            <span className="text-good">Claude connected</span>
          ) : (
            <span className="text-accent-deep">
              mock mode — add ANTHROPIC_API_KEY to enable real planning
            </span>
          )}
        </p>
      </section>

      <section className="card p-4">
        <h2 className="flex items-center gap-2 font-bold tracking-tight">
          <Luggage size={17} className="text-accent" /> Upcoming absences
        </h2>
        {(absencesData?.absences ?? []).length === 0 && (
          <p className="mt-1 text-sm text-faint">
            None — add one from the Week screen (&quot;Mark away&quot;).
          </p>
        )}
        <ul className="mt-2 space-y-2 text-sm">
          {(absencesData?.absences ?? []).map((a) => (
            <li key={a.id} className="flex items-center justify-between">
              <span>
                {a.memberId ? memberName.get(a.memberId) : "Whole family"} ·{" "}
                {a.startDate} → {a.endDate}
                <span className="ml-1 text-xs text-faint">({a.type})</span>
              </span>
              <button
                onClick={() => removeAbsence.mutate(a.id)}
                className="text-faint"
              >
                <X size={15} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <ReminderSection vapidPublicKey={settings?.vapidPublicKey ?? null} />

      <section className="card p-4">
        <h2 className="flex items-center gap-2 font-bold tracking-tight">
          <Smartphone size={17} className="text-accent" /> “Save to Meal
          Planner” Shortcut
        </h2>
        <p className="mt-1 text-sm text-soft">
          One-time setup (~1 min) so you can share Instagram recipes straight to
          this app:
        </p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-soft">
          <li>
            Open the <b className="text-ink">Shortcuts</b> app → <b>+</b> → name
            it <b className="text-ink">Save to Meal Planner</b>.
          </li>
          <li>
            Tap the info (ⓘ) button → enable{" "}
            <b className="text-ink">Show in Share Sheet</b> → set input to{" "}
            <b className="text-ink">URLs</b>.
          </li>
          <li>
            Add action <b className="text-ink">Get Contents of URL</b> and
            configure:
            <div className="mt-1.5 space-y-1 rounded-2xl border border-line bg-surface/60 p-2.5 font-mono text-[11px]">
              <div>URL: {settings?.bookmarksEndpoint ?? "…"}</div>
              <div>Method: POST</div>
              <div>
                Headers: Authorization = Bearer {settings?.shortcutToken ?? "…"}
              </div>
              <div>Request Body: JSON → url = Shortcut Input</div>
            </div>
          </li>
          <li>
            In Instagram: <b className="text-ink">Share → Save to Meal Planner</b>
            . The link lands in your Saved links inbox.
          </li>
        </ol>
      </section>

      <section className="card p-4">
        <h2 className="flex items-center gap-2 font-bold tracking-tight">
          <Check size={17} className="text-good" /> Install this app
        </h2>
        <p className="mt-1 text-sm text-soft">
          In Safari: <b className="text-ink">Share → Add to Home Screen</b>. Do
          this on both phones — installed apps keep their data and open
          full-screen.
        </p>
      </section>
    </div>
  );
}

function ReminderSection({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [status, setStatus] = useState<
    "loading" | "off" | "on" | "unsupported" | "needs-install"
  >("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const support = pushSupport();
    if (support !== "ok") {
      setStatus(support === "needs-install" ? "needs-install" : "unsupported");
      return;
    }
    currentSubscription().then((sub) => setStatus(sub ? "on" : "off"));
  }, []);

  async function toggle() {
    if (!vapidPublicKey) return;
    setBusy(true);
    setError(null);
    try {
      if (status === "on") {
        await unsubscribeFromPush();
        setStatus("off");
      } else {
        await subscribeToPush(vapidPublicKey);
        setStatus("on");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-4">
      <h2 className="flex items-center gap-2 font-bold tracking-tight">
        <Bell size={17} className="text-accent" /> Sunday reminder
      </h2>
      <p className="mt-1 text-sm text-soft">
        A gentle Sunday-morning nudge on this phone: &ldquo;time to plan the
        week&rdquo;.
      </p>
      {status === "needs-install" && (
        <p className="mt-2 rounded-2xl bg-accent-soft px-3.5 py-2.5 text-xs text-accent-deep">
          Install the app first (Share → Add to Home Screen) — iPhones only
          allow notifications for installed apps.
        </p>
      )}
      {status === "unsupported" && (
        <p className="mt-2 text-xs text-faint">
          This browser doesn&apos;t support web notifications.
        </p>
      )}
      {(status === "on" || status === "off") && (
        <button
          onClick={toggle}
          disabled={busy || !vapidPublicKey}
          className={`mt-3 w-full py-3 text-sm disabled:opacity-50 ${
            status === "on" ? "btn-secondary" : "btn-primary"
          }`}
        >
          {busy
            ? "Working…"
            : status === "on"
              ? "Reminder is on — turn off for this phone"
              : "Turn on the Sunday reminder"}
        </button>
      )}
      {error && <p className="mt-2 text-xs text-bad">{error}</p>}
    </section>
  );
}


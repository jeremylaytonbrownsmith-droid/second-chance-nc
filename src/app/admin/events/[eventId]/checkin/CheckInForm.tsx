"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useToast } from "@/components/Toast";
import { button, card, input, label as labelClass } from "@/app/admin/ui";

interface ConstituentOption {
  id: string;
  firstName: string | null;
  lastName: string | null;
  orgName: string | null;
  isBusiness: boolean;
  email: string | null;
}

interface CheckedInResult {
  registrationId: string;
  bidderNumber: number;
  qrDataUrl: string;
  bidUrl: string;
}

function displayName(c: ConstituentOption): string {
  return c.isBusiness ? (c.orgName ?? "") : `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
}

export function CheckInForm({ eventId, orgId }: { eventId: string; orgId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ConstituentOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [checkedIn, setCheckedIn] = useState<CheckedInResult | null>(null);
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [walkInSubmitting, setWalkInSubmitting] = useState(false);
  const toast = useToast();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/constituents?orgId=${orgId}&q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.constituents ?? []);
      } catch {
        toast.error("Search failed — try again.");
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, orgId]);

  async function finishCheckIn(registration: { id: string; bidderNumber: number }) {
    const bidUrl = `${window.location.origin}/bid/${registration.id}`;
    const qrDataUrl = await QRCode.toDataURL(bidUrl, { width: 240, margin: 1 });
    setCheckedIn({ registrationId: registration.id, bidderNumber: registration.bidderNumber, qrDataUrl, bidUrl });
    toast.success(`Checked in — paddle #${registration.bidderNumber}.`);
  }

  async function checkInExisting(constituentId: string) {
    setCheckingInId(constituentId);
    try {
      const res = await fetch("/api/admin/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, constituentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Check-in failed");
        return;
      }
      await finishCheckIn(data.registration);
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setCheckingInId(null);
    }
  }

  async function submitWalkIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const walkIn = {
      firstName: String(form.get("firstName") || "") || undefined,
      lastName: String(form.get("lastName") || "") || undefined,
      email: String(form.get("email") || ""),
      phone: String(form.get("phone") || "") || undefined,
    };
    setWalkInSubmitting(true);
    try {
      const res = await fetch("/api/admin/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, orgId, walkIn }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Check-in failed");
        return;
      }
      await finishCheckIn(data.registration);
      setShowWalkIn(false);
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setWalkInSubmitting(false);
    }
  }

  if (checkedIn) {
    return (
      <div className={`mx-auto max-w-sm text-center ${card}`}>
        <p className="text-sm text-neutral-500">Checked in as</p>
        <p className="text-3xl font-bold text-brand-purple-dark">Paddle #{checkedIn.bidderNumber}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={checkedIn.qrDataUrl} alt="QR code to open the bidder view" className="mx-auto mt-4 h-60 w-60" />
        <p className="mt-2 text-xs text-neutral-500">Scan with your phone to place bids.</p>
        <a href={checkedIn.bidUrl} target="_blank" rel="noopener noreferrer" className={`mt-3 inline-block ${button.secondary}`}>
          Open bidder view
        </a>
        <button
          onClick={() => {
            setCheckedIn(null);
            setQuery("");
            setResults([]);
          }}
          className={`mt-3 block w-full ${button.primary}`}
        >
          Check in someone else
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className={card}>
        <label className={labelClass}>Search by name or email</label>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Start typing…"
          className={`mt-1 w-full ${input}`}
        />
        {searching && <p className="mt-2 text-xs text-neutral-500">Searching…</p>}
        <div className="mt-3 space-y-2">
          {results.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-neutral-200 p-2 text-sm">
              <span>
                <span className="font-medium">{displayName(c) || "(no name)"}</span>
                <span className="block text-xs text-neutral-500">{c.email ?? "—"}</span>
              </span>
              <button
                onClick={() => checkInExisting(c.id)}
                disabled={checkingInId === c.id}
                className={button.primary}
              >
                {checkingInId === c.id ? "Checking in…" : "Check in"}
              </button>
            </div>
          ))}
          {query.trim() && !searching && results.length === 0 && (
            <p className="text-sm text-neutral-500">No matches.</p>
          )}
        </div>
      </div>

      {!showWalkIn ? (
        <button onClick={() => setShowWalkIn(true)} className={button.ghost}>
          Can&apos;t find them? Add as a walk-in →
        </button>
      ) : (
        <form onSubmit={submitWalkIn} className={`space-y-3 ${card}`}>
          <p className="text-sm font-medium text-neutral-700">New walk-in bidder</p>
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <label className={labelClass}>First name</label>
              <input name="firstName" className={input} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Last name</label>
              <input name="lastName" className={input} />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Email</label>
              <input name="email" type="email" className={input} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Phone</label>
              <input name="phone" className={input} />
            </div>
          </div>
          <button type="submit" disabled={walkInSubmitting} className={button.primary}>
            {walkInSubmitting ? "Checking in…" : "Check in"}
          </button>
        </form>
      )}
    </div>
  );
}

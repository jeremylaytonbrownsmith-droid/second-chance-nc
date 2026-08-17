"use client";

import { useState } from "react";
import { CameraIcon } from "../../../../icons";

const MAX_PHOTOS = 3;
const MAX_DIMENSION = 900;
const JPEG_QUALITY = 0.72;

interface Props {
  eventId: string;
  orgId: string;
  categories: string[];
  suggestedItemNumber: string;
  solicitationId?: string;
  prefillContactName?: string;
  prefillContactEmail?: string;
  prefillContactPhone?: string;
  prefillCategory?: string;
}

/** Resizes/compresses a photo client-side before it goes over the wire —
 * a phone camera photo can be 4-8MB; nothing here needs more than a
 * ~900px-wide JPEG to be useful in the catalog. */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read image"));
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas unavailable"));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function DonationIntakeForm({
  eventId,
  orgId,
  categories,
  suggestedItemNumber,
  solicitationId,
  prefillContactName,
  prefillContactEmail,
  prefillContactPhone,
  prefillCategory,
}: Props) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState("");
  const [itemNumber, setItemNumber] = useState(suggestedItemNumber);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(prefillCategory ?? "");
  const [valueDollars, setValueDollars] = useState("");
  const [isBusiness, setIsBusiness] = useState(Boolean(prefillContactName));
  const [donorName, setDonorName] = useState(prefillContactName ?? "");
  const [donorEmail, setDonorEmail] = useState(prefillContactEmail ?? "");
  const [donorPhone, setDonorPhone] = useState(prefillContactPhone ?? "");
  const [actorId, setActorId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ auctionItemId: string } | null>(null);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPhotoError("");
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    if (photos.length + files.length > MAX_PHOTOS) {
      setPhotoError(`Up to ${MAX_PHOTOS} photos.`);
      return;
    }
    try {
      const compressed = await Promise.all(files.map(compressImage));
      setPhotos((prev) => [...prev, ...compressed]);
    } catch {
      setPhotoError("Couldn't process that photo — try another.");
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setError("");
    setResult(null);
    if (!title.trim()) {
      setError("Give the item a short title.");
      return;
    }
    if (!valueDollars || Number(valueDollars) < 0) {
      setError("Enter an estimated value.");
      return;
    }
    if (!donorName.trim()) {
      setError("Enter the donor's name or business name.");
      return;
    }
    if (!actorId.trim()) {
      setError("Enter your name.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/donations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          orgId,
          solicitationId,
          donor: { isBusiness, name: donorName, email: donorEmail || "", phone: donorPhone },
          itemNumber,
          title,
          description,
          category: category || undefined,
          estimatedValueCents: Math.round(Number(valueDollars) * 100),
          images: photos,
          actorId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Couldn't save this donation.");
        return;
      }
      setResult(data);
    } catch {
      setError("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="max-w-xl rounded border border-green-200 bg-green-50 p-5">
        <h2 className="font-semibold text-green-900">Donation logged</h2>
        <p className="mt-1 text-sm text-green-800">
          {title || "The item"} is now in the catalog as item #{itemNumber}, with an
          estimated FMV of ${Number(valueDollars).toFixed(2)}. Confirm/adjust the FMV
          from the item catalog before it opens for bidding.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <a href={`/admin/events/${eventId}`} className="text-brand-purple underline">
            View item catalog
          </a>
          <button
            onClick={() => {
              setResult(null);
              setPhotos([]);
              setTitle("");
              setDescription("");
              setValueDollars("");
              setItemNumber(`D${Number(suggestedItemNumber.replace("D", "")) + 1}`);
            }}
            className="text-brand-purple underline"
          >
            Log another donation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-5 rounded border border-brand-lavender bg-white p-5">
      <div>
        <label className="block text-xs text-neutral-500">Photos (up to {MAX_PHOTOS})</label>
        <div className="mt-2 flex flex-wrap gap-3">
          {photos.map((src, i) => (
            <div key={i} className="relative h-24 w-24 overflow-hidden rounded border border-neutral-300">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Donation photo ${i + 1}`} className="h-full w-full object-cover" />
              <button
                onClick={() => removePhoto(i)}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 px-1.5 text-xs text-white"
                aria-label="Remove photo"
              >
                ×
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded border border-dashed border-neutral-300 text-neutral-500 transition-colors hover:border-brand-purple hover:text-brand-purple">
              <CameraIcon />
              <span className="text-xs">Add photo</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handlePhotoChange}
                className="hidden"
              />
            </label>
          )}
        </div>
        {photoError && <p className="mt-1 text-xs text-red-600">{photoError}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col">
          <label className="text-xs text-neutral-500">Item #</label>
          <input
            value={itemNumber}
            onChange={(e) => setItemNumber(e.target.value)}
            className="rounded border border-neutral-300 px-2 py-1"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-neutral-500">Category</label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            list="donation-categories"
            placeholder="e.g. Getaways"
            className="rounded border border-neutral-300 px-2 py-1"
          />
          <datalist id="donation-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="flex flex-col">
        <label className="text-xs text-neutral-500">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Weekend at the Lake House"
          className="rounded border border-neutral-300 px-2 py-1"
        />
      </div>

      <div className="flex flex-col">
        <label className="text-xs text-neutral-500">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="rounded border border-neutral-300 px-2 py-1"
        />
      </div>

      <div className="flex flex-col">
        <label className="text-xs text-neutral-500">Estimated value ($)</label>
        <input
          value={valueDollars}
          onChange={(e) => setValueDollars(e.target.value)}
          type="number"
          step="0.01"
          min={0}
          className="w-32 rounded border border-neutral-300 px-2 py-1"
        />
        <p className="mt-1 text-xs text-neutral-400">
          Used as both the item&rsquo;s FMV and the donor&rsquo;s claimed value —
          adjust either later if they should differ.
        </p>
      </div>

      <div className="border-t border-neutral-100 pt-4">
        <label className="flex items-center gap-2 text-xs text-neutral-500">
          <input type="checkbox" checked={isBusiness} onChange={(e) => setIsBusiness(e.target.checked)} />
          This is a business donor
        </label>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col">
            <label className="text-xs text-neutral-500">
              {isBusiness ? "Business name" : "Donor name"}
            </label>
            <input
              value={donorName}
              onChange={(e) => setDonorName(e.target.value)}
              className="rounded border border-neutral-300 px-2 py-1"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-neutral-500">Email</label>
            <input
              value={donorEmail}
              onChange={(e) => setDonorEmail(e.target.value)}
              type="email"
              className="rounded border border-neutral-300 px-2 py-1"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-neutral-500">Phone</label>
            <input
              value={donorPhone}
              onChange={(e) => setDonorPhone(e.target.value)}
              className="rounded border border-neutral-300 px-2 py-1"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col">
        <label className="text-xs text-neutral-500">Your name</label>
        <input
          value={actorId}
          onChange={(e) => setActorId(e.target.value)}
          className="w-48 rounded border border-neutral-300 px-2 py-1"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="rounded bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-dark disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Save donation"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

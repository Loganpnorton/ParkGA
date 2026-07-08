"use client";

import { useState, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Loader2,
  X,
  Upload,
  MapPin,
  DollarSign,
  Home,
  Sparkles,
  Camera,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// ─── Step configuration ────────────────────────────────────────────────
const STEPS = [
  { id: "basic", label: "Basic Details", icon: Home, description: "Title & description" },
  { id: "address", label: "Address", icon: MapPin, description: "Location & coordinates" },
  { id: "features", label: "Features", icon: Sparkles, description: "Amenities & perks" },
  { id: "pricing", label: "Pricing", icon: DollarSign, description: "Set your rates" },
  { id: "photos", label: "Photos", icon: Camera, description: "Upload images" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

// ─── Available features (stored as JSONB) ──────────────────────────────
const AVAILABLE_FEATURES = [
  { key: "covered", label: "Covered Parking" },
  { key: "secure", label: "Security Camera" },
  { key: "ev_charger", label: "EV Charger" },
  { key: "247_access", label: "24/7 Access" },
  { key: "handicap", label: "Handicap Accessible" },
  { key: "oversize", label: "Oversize Vehicle" },
  { key: "lighting", label: "Well Lit" },
  { key: "gate", label: "Gated Entry" },
] as const;

// ─── Form data shape (maps 1:1 to spots table) ─────────────────────────
interface FormData {
  title: string;
  description: string;
  address: string;
  lat: string;
  lng: string;
  features: Record<string, boolean>;
  price_per_hour: string;
  price_per_event: string;
  files: File[];
}

const INITIAL_FORM: FormData = {
  title: "",
  description: "",
  address: "",
  lat: "",
  lng: "",
  features: Object.fromEntries(AVAILABLE_FEATURES.map((f) => [f.key, false])),
  price_per_hour: "",
  price_per_event: "",
  files: [],
};

// ─── Validation per step ───────────────────────────────────────────────
function validateStep(step: StepId, data: FormData): string | null {
  switch (step) {
    case "basic":
      if (!data.title.trim()) return "Title is required.";
      if (!data.description.trim()) return "Description is required.";
      if (data.description.length < 20) return "Description must be at least 20 characters.";
      return null;
    case "address":
      if (!data.address.trim()) return "Address is required.";
      if (!data.lat || !data.lng) return "Latitude and longitude are required.";
      const lat = parseFloat(data.lat);
      const lng = parseFloat(data.lng);
      if (isNaN(lat) || lat < -90 || lat > 90) return "Latitude must be between -90 and 90.";
      if (isNaN(lng) || lng < -180 || lng > 180) return "Longitude must be between -180 and 180.";
      return null;
    case "pricing":
      const ph = parseFloat(data.price_per_hour);
      const pe = parseFloat(data.price_per_event);
      if (!data.price_per_hour && !data.price_per_event) {
        return "Set at least one price (hourly or event).";
      }
      if (data.price_per_hour && (isNaN(ph) || ph <= 0)) return "Hourly price must be greater than 0.";
      if (data.price_per_event && (isNaN(pe) || pe <= 0)) return "Event price must be greater than 0.";
      return null;
    case "features":
    case "photos":
      return null; // optional
    default:
      return null;
  }
}

// ─── Page Component ────────────────────────────────────────────────────
export default function NewListingPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentStep, setCurrentStep] = useState<StepId>("basic");
  const stepIndex = STEPS.findIndex((s) => s.id === currentStep);

  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // ── Helpers ──────────────────────────────────────────────────────
  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  function toggleFeature(key: string) {
    setForm((prev) => ({
      ...prev,
      features: { ...prev.features, [key]: !prev.features[key] },
    }));
  }

  function goToStep(step: StepId) {
    setError(null);
    setCurrentStep(step);
  }

  function goNext() {
    const err = validateStep(currentStep, form);
    if (err) {
      setError(err);
      return;
    }
    const nextIdx = stepIndex + 1;
    if (nextIdx < STEPS.length) {
      setCurrentStep(STEPS[nextIdx].id);
      setError(null);
    }
  }

  function goBack() {
    if (stepIndex > 0) {
      setCurrentStep(STEPS[stepIndex - 1].id);
      setError(null);
    }
  }

  // ── File handling ─────────────────────────────────────────────────
  function handleFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    const maxSize = 5 * 1024 * 1024; // 5 MB

    const valid: File[] = [];
    const blobs: string[] = [];

    for (const file of Array.from(newFiles)) {
      if (!allowed.includes(file.type)) continue;
      if (file.size > maxSize) continue;
      if (form.files.length + valid.length >= 6) break; // max 6 images
      valid.push(file);
      blobs.push(URL.createObjectURL(file));
    }

    setForm((prev) => ({ ...prev, files: [...prev.files, ...valid] }));
    setPreviews((prev) => [...prev, ...blobs]);
  }

  function removeFile(index: number) {
    URL.revokeObjectURL(previews[index]);
    setForm((prev) => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Submit ────────────────────────────────────────────────────────
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // Validate all steps
    for (const step of STEPS) {
      const err = validateStep(step.id, form);
      if (err) {
        setError(`${step.label}: ${err}`);
        setCurrentStep(step.id);
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be signed in to list a spot.");
      setSubmitting(false);
      return;
    }

    // 1) Upload images to Supabase Storage
    const imageUrls: string[] = [];
    for (let i = 0; i < form.files.length; i++) {
      const file = form.files[i];
      const ext = file.name.split(".").pop() ?? "jpg";
      const filePath = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("spot-images")
        .upload(filePath, file);

      if (uploadErr) {
        setError(`Failed to upload image ${i + 1}: ${uploadErr.message}`);
        setSubmitting(false);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("spot-images").getPublicUrl(filePath);
      imageUrls.push(publicUrl);
    }

    // 2) Build features JSON (only truthy keys)
    const featuresJson: Record<string, boolean> = {};
    for (const [key, val] of Object.entries(form.features)) {
      if (val) featuresJson[key] = true;
    }

    // 3) Insert spot row
    const { error: insertErr } = await supabase.from("spots").insert({
      host_id: user.id,
      title: form.title.trim(),
      description: form.description.trim(),
      address: form.address.trim(),
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
      price_per_hour: form.price_per_hour ? parseFloat(form.price_per_hour) : null,
      price_per_event: form.price_per_event ? parseFloat(form.price_per_event) : null,
      features: featuresJson,
      images: imageUrls,
    });

    if (insertErr) {
      setError(insertErr.message);
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setSubmitting(false);
  }

  // ── Progress percentage ───────────────────────────────────────────
  const progressPct = Math.round(((stepIndex + 1) / STEPS.length) * 100);

  // ── Success state ─────────────────────────────────────────────────
  if (success) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-parkga-100">
            <Check className="h-8 w-8 text-parkga-600" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
            Listing Published!
          </h1>
          <p className="mt-3 text-sm text-gray-600">
            Your parking spot is now live. Drivers can find and book it instantly.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-lg bg-parkga-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-parkga-700"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => {
                setForm(INITIAL_FORM);
                setPreviews([]);
                setSuccess(false);
                setCurrentStep("basic");
              }}
              className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              List Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          List Your Parking Space
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Fill in the details below to start earning.
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Step {stepIndex + 1} of {STEPS.length}
          </span>
          <span>{progressPct}%</span>
        </div>
        <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
          <div
            className="h-2 rounded-full bg-parkga-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <nav className="mb-8 hidden sm:block">
        <ol className="flex items-center">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isPast = stepIndex > idx;
            return (
              <li key={step.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => goToStep(step.id)}
                  className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "text-parkga-600"
                      : isPast
                        ? "text-parkga-600 hover:text-parkga-700"
                        : "text-gray-400"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      isActive
                        ? "bg-parkga-100 text-parkga-600"
                        : isPast
                          ? "bg-parkga-600 text-white"
                          : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {isPast ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                  </span>
                  <span className="hidden lg:inline">{step.label}</span>
                </button>
                {idx < STEPS.length - 1 && (
                  <ChevronRight
                    className={`mx-2 h-4 w-4 ${
                      idx < stepIndex ? "text-parkga-400" : "text-gray-300"
                    }`}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Form card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <form onSubmit={currentStep === "photos" ? handleSubmit : (e) => e.preventDefault()}>
          {/* Error */}
          {error && (
            <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* ── Step 1: Basic Details ──────────────────────────────── */}
          {currentStep === "basic" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Basic Details</h2>
                <p className="mt-1 text-sm text-gray-500">Tell drivers about your space.</p>
              </div>
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                  Title
                </label>
                <input
                  id="title"
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  placeholder="e.g. Covered Driveway in Downtown Atlanta"
                  className="mt-1.5 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 transition-colors focus:border-parkga-500 focus:outline-none focus:ring-2 focus:ring-parkga-500/20"
                />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  id="description"
                  required
                  rows={4}
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Describe the parking spot — dimensions, accessibility, nearby landmarks, etc."
                  className="mt-1.5 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 transition-colors focus:border-parkga-500 focus:outline-none focus:ring-2 focus:ring-parkga-500/20"
                />
                <p className="mt-1 text-xs text-gray-400">
                  {form.description.length} characters (min 20)
                </p>
              </div>
            </div>
          )}

          {/* ── Step 2: Address ────────────────────────────────────── */}
          {currentStep === "address" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Address</h2>
                <p className="mt-1 text-sm text-gray-500">Where is your parking spot located?</p>
              </div>
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                  Street Address
                </label>
                <input
                  id="address"
                  type="text"
                  required
                  value={form.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  placeholder="123 Main St, Atlanta, GA 30303"
                  className="mt-1.5 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 transition-colors focus:border-parkga-500 focus:outline-none focus:ring-2 focus:ring-parkga-500/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="lat" className="block text-sm font-medium text-gray-700">
                    Latitude
                  </label>
                  <input
                    id="lat"
                    type="number"
                    step="any"
                    required
                    value={form.lat}
                    onChange={(e) => updateField("lat", e.target.value)}
                    placeholder="33.7490"
                    className="mt-1.5 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 transition-colors focus:border-parkga-500 focus:outline-none focus:ring-2 focus:ring-parkga-500/20"
                  />
                </div>
                <div>
                  <label htmlFor="lng" className="block text-sm font-medium text-gray-700">
                    Longitude
                  </label>
                  <input
                    id="lng"
                    type="number"
                    step="any"
                    required
                    value={form.lng}
                    onChange={(e) => updateField("lng", e.target.value)}
                    placeholder="-84.3880"
                    className="mt-1.5 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 transition-colors focus:border-parkga-500 focus:outline-none focus:ring-2 focus:ring-parkga-500/20"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400">
                You can find coordinates using Google Maps (right-click on a location).
              </p>
            </div>
          )}

          {/* ── Step 3: Features ───────────────────────────────────── */}
          {currentStep === "features" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Features & Amenities</h2>
                <p className="mt-1 text-sm text-gray-500">Select what your spot offers.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {AVAILABLE_FEATURES.map((feature) => {
                  const checked = form.features[feature.key];
                  return (
                    <button
                      key={feature.key}
                      type="button"
                      onClick={() => toggleFeature(feature.key)}
                      className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-all ${
                        checked
                          ? "border-parkga-500 bg-parkga-50 text-parkga-700"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                          checked
                            ? "border-parkga-600 bg-parkga-600 text-white"
                            : "border-gray-300"
                        }`}
                      >
                        {checked && <Check className="h-3 w-3" />}
                      </span>
                      {feature.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Step 4: Pricing ────────────────────────────────────── */}
          {currentStep === "pricing" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Pricing</h2>
                <p className="mt-1 text-sm text-gray-500">Set your rates. You can offer hourly, event-based, or both.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="price_hour" className="block text-sm font-medium text-gray-700">
                    Price per hour ($)
                  </label>
                  <div className="relative mt-1.5">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      id="price_hour"
                      type="number"
                      min="0"
                      step="0.50"
                      value={form.price_per_hour}
                      onChange={(e) => updateField("price_per_hour", e.target.value)}
                      placeholder="5.00"
                      className="block w-full rounded-lg border border-gray-300 px-7 py-2.5 text-gray-900 placeholder-gray-400 transition-colors focus:border-parkga-500 focus:outline-none focus:ring-2 focus:ring-parkga-500/20"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="price_event" className="block text-sm font-medium text-gray-700">
                    Price per event ($)
                  </label>
                  <div className="relative mt-1.5">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      id="price_event"
                      type="number"
                      min="0"
                      step="0.50"
                      value={form.price_per_event}
                      onChange={(e) => updateField("price_per_event", e.target.value)}
                      placeholder="25.00"
                      className="block w-full rounded-lg border border-gray-300 px-7 py-2.5 text-gray-900 placeholder-gray-400 transition-colors focus:border-parkga-500 focus:outline-none focus:ring-2 focus:ring-parkga-500/20"
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400">
                You must set at least one price. Event pricing is ideal for game days or concerts.
              </p>
            </div>
          )}

          {/* ── Step 5: Photos ─────────────────────────────────────── */}
          {currentStep === "photos" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Photos</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Upload up to 6 images of your parking space (JPEG, PNG, or WebP, max 5MB each).
                </p>
              </div>

              {/* Drop zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFiles(e.dataTransfer.files);
                }}
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 p-8 transition-colors hover:border-parkga-400 hover:bg-parkga-50/30"
              >
                <Upload className="mb-3 h-8 w-8 text-gray-400" />
                <p className="text-sm font-medium text-gray-700">
                  Drop images here or click to browse
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {form.files.length} / 6 images selected
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </div>

              {/* Preview grid */}
              {previews.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {previews.map((src, idx) => (
                    <div key={src} className="group relative aspect-video overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                      <Image
                        src={src}
                        alt={`Preview ${idx + 1}`}
                        fill
                        className="object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label={`Remove image ${idx + 1}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Navigation buttons ─────────────────────────────────── */}
          <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-6">
            <button
              type="button"
              onClick={goBack}
              disabled={stepIndex === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            {currentStep === "photos" ? (
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-parkga-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-parkga-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Publish Listing
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                className="inline-flex items-center gap-2 rounded-lg bg-parkga-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-parkga-700"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
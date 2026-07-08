"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Calendar,
  List,
  User,
  Loader2,
  Camera,
  Save,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type Tab = "bookings" | "listings" | "profile";

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "bookings", label: "My Bookings", icon: Calendar },
  { id: "listings", label: "My Listings", icon: List },
  { id: "profile", label: "Profile", icon: User },
];

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(true);

  // Profile form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Check auth session
  useEffect(() => {
    async function checkSession() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }
      setSessionLoading(false);
    }
    checkSession();
  }, [router, supabase]);

  // Fetch profile
  useEffect(() => {
    if (sessionLoading) return;

    async function fetchProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data);
        setName(data.name ?? "");
        setPhone(data.phone ?? "");
        setAvatarUrl(data.avatar_url);
      }
      setLoading(false);
    }

    fetchProfile();
  }, [sessionLoading, supabase]);

  // Handle avatar file selection
  function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
      setSaveError("Please select a JPEG, PNG, GIF, or WebP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setSaveError("Image must be under 2MB.");
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setSaveError(null);
  }

  // Save profile
  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaveError("You must be signed in.");
      setSaving(false);
      return;
    }

    let newAvatarUrl = avatarUrl;

    // Upload avatar if changed
    if (avatarFile) {
      const fileExt = avatarFile.name.split(".").pop() ?? "jpg";
      const filePath = `${user.id}/avatar.${fileExt}`;

      // Delete old avatar if exists
      if (avatarUrl) {
        const oldPath = avatarUrl.split("/").slice(-2).join("/");
        await supabase.storage.from("avatars").remove([oldPath]);
      }

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, avatarFile, { upsert: true });

      if (uploadError) {
        setSaveError(uploadError.message);
        setSaving(false);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);
      newAvatarUrl = publicUrl;
    }

    // Update profile row
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        name,
        phone: phone || null,
        avatar_url: newAvatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      setSaveError(updateError.message);
      setSaving(false);
      return;
    }

    setAvatarUrl(newAvatarUrl);
    setAvatarFile(null);
    setAvatarPreview(null);
    setProfile((prev) =>
      prev
        ? { ...prev, name, phone: phone || null, avatar_url: newAvatarUrl }
        : prev,
    );
    setSaveSuccess(true);
    setSaving(false);
  }

  // Sign out
  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  // Auth loading state
  if (sessionLoading || loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-parkga-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your bookings, listings, and profile
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-8 border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-parkga-600 text-parkga-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "bookings" && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <Calendar className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">
            No bookings yet
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            When you book a parking spot, it will appear here.
          </p>
        </div>
      )}

      {activeTab === "listings" && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <List className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">
            No listings yet
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            List a parking space to start earning.
          </p>
        </div>
      )}

      {activeTab === "profile" && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <form onSubmit={handleSave} className="space-y-8">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <div className="relative">
                <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-gray-200 bg-gray-100">
                  {(avatarPreview || avatarUrl) && (
                    <Image
                      src={avatarPreview ?? avatarUrl!}
                      alt="Profile avatar"
                      width={96}
                      height={96}
                      className="h-full w-full object-cover"
                    />
                  )}
                  {!avatarPreview && !avatarUrl && (
                    <div className="flex h-full w-full items-center justify-center">
                      <User className="h-10 w-10 text-gray-400" />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-parkga-600 text-white shadow-sm transition-colors hover:bg-parkga-700"
                  aria-label="Change avatar"
                >
                  <Camera className="h-4 w-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={handleAvatarSelect}
                />
              </div>
              <div className="text-center sm:text-left">
                <h3 className="text-lg font-semibold text-gray-900">
                  Profile Photo
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  JPEG, PNG, GIF, or WebP. Max 2MB.
                </p>
                {avatarFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarFile(null);
                      setAvatarPreview(null);
                    }}
                    className="mt-2 text-sm font-medium text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* Success / Error messages */}
            {saveSuccess && (
              <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                Profile updated successfully.
              </div>
            )}
            {saveError && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {saveError}
              </div>
            )}

            {/* Name */}
            <div>
              <label
                htmlFor="profile-name"
                className="block text-sm font-medium text-gray-700"
              >
                Full name
              </label>
              <input
                id="profile-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 transition-colors focus:border-parkga-500 focus:outline-none focus:ring-2 focus:ring-parkga-500/20"
              />
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                value={profile?.id ? "" : ""}
                disabled
                className="mt-1.5 block w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-500"
                placeholder="Email linked to your account"
              />
              <p className="mt-1 text-xs text-gray-400">
                Email is managed through your authentication provider.
              </p>
            </div>

            {/* Phone */}
            <div>
              <label
                htmlFor="profile-phone"
                className="block text-sm font-medium text-gray-700"
              >
                Phone number
              </label>
              <input
                id="profile-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
                className="mt-1.5 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 transition-colors focus:border-parkga-500 focus:outline-none focus:ring-2 focus:ring-parkga-500/20"
              />
            </div>

            {/* Role (read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Account type
              </label>
              <div className="mt-1.5">
                <span className="inline-flex items-center rounded-full bg-parkga-100 px-3 py-1 text-sm font-medium text-parkga-700">
                  {profile?.role === "host"
                    ? "Host"
                    : profile?.role === "admin"
                      ? "Admin"
                      : "Guest"}
                </span>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end border-t border-gray-100 pt-6">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-parkga-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-parkga-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
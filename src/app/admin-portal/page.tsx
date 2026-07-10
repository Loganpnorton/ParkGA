"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2,
  Users,
  MapPin,
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Shield,
  BarChart3,
  Calendar,
  Clock,
} from "lucide-react";
import Link from "next/link";

// ─── Types ─────────────────────────────────────────────────────────────
interface AdminStats {
  totalUsers: number;
  activeSpots: number;
  totalSpots: number;
  totalRevenue: number;
  pendingBookings: number;
  completedBookings: number;
  hostCount: number;
  guestCount: number;
}

interface SpotRow {
  id: string;
  title: string;
  address: string;
  host_id: string;
  active: boolean;
  price_per_hour: number | null;
  price_per_event: number | null;
  bookings_count?: number;
  host_name?: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export default function AdminPortalPage() {
  const supabase = createClient();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [spots, setSpots] = useState<SpotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingSpot, setTogglingSpot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // ── Aggregate Stats ──────────────────────────────────────
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      const { count: activeSpots } = await supabase
        .from("spots")
        .select("*", { count: "exact", head: true })
        .eq("active", true);

      const { count: totalSpots } = await supabase
        .from("spots")
        .select("*", { count: "exact", head: true });

      const { count: hostCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "host");

      const { count: guestCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "guest");

      const { count: pendingBookings } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      const { count: completedBookings } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .in("status", ["confirmed", "active", "completed"]);

      // ── Revenue: SUM(total_price * 0.15) from paid bookings ──
      const { data: revenueData } = await supabase
        .from("bookings")
        .select("total_price")
        .in("status", ["confirmed", "active", "completed"]);

      const totalRevenue =
        revenueData?.reduce(
          (sum, b) => sum + Number(b.total_price) * 0.15,
          0,
        ) ?? 0;

      setStats({
        totalUsers: totalUsers ?? 0,
        activeSpots: activeSpots ?? 0,
        totalSpots: totalSpots ?? 0,
        totalRevenue,
        pendingBookings: pendingBookings ?? 0,
        completedBookings: completedBookings ?? 0,
        hostCount: hostCount ?? 0,
        guestCount: guestCount ?? 0,
      });

      // ── All Spots for Moderation ─────────────────────────────
      const { data: spotData } = await supabase
        .from("spots")
        .select("*, host:host_id(name)")
        .order("created_at", { ascending: false });

      if (spotData) {
        const { data: bookingCounts } = await supabase
          .from("bookings")
          .select("spot_id")
          .in("status", ["confirmed", "active", "completed"]);

        const countMap: Record<string, number> = {};
        if (bookingCounts) {
          bookingCounts.forEach((b) => {
            countMap[b.spot_id] = (countMap[b.spot_id] ?? 0) + 1;
          });
        }

        setSpots(
          spotData.map((s: any) => ({
            id: s.id,
            title: s.title,
            address: s.address,
            host_id: s.host_id,
            active: s.active ?? true,
            price_per_hour: s.price_per_hour,
            price_per_event: s.price_per_event,
            host_name: s.host?.name ?? "Unknown",
            bookings_count: countMap[s.id] ?? 0,
          })),
        );
      }
    } catch (err: any) {
      setError(err.message ?? "Failed to load admin data");
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Toggle spot active status ────────────────────────────────
  async function toggleSpotActive(spotId: string, currentlyActive: boolean) {
    setTogglingSpot(spotId);
    setError(null);
    setSuccessMsg(null);

    const { error: updateError } = await supabase
      .from("spots")
      .update({ active: !currentlyActive, updated_at: new Date().toISOString() })
      .eq("id", spotId);

    if (updateError) {
      setError(`Failed to update spot: ${updateError.message}`);
    } else {
      setSuccessMsg(
        `Spot ${currentlyActive ? "deactivated" : "activated"} successfully.`,
      );
      setSpots((prev) =>
        prev.map((s) =>
          s.id === spotId ? { ...s, active: !currentlyActive } : s,
        ),
      );
      // Update stats
      setStats((prev) =>
        prev
          ? {
              ...prev,
              activeSpots: currentlyActive
                ? prev.activeSpots - 1
                : prev.activeSpots + 1,
            }
          : prev,
      );
      setTimeout(() => setSuccessMsg(null), 3000);
    }

    setTogglingSpot(null);
  }

  if (loading && !stats) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-parkga-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
              <Shield className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                Admin Portal
              </h1>
              <p className="mt-0.5 text-sm text-gray-500">
                Platform overview and moderation controls
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Error / Success */}
      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {successMsg && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700">
          <CheckCircle className="h-4 w-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* ═══ Stats Cards ═══ */}
      {stats && (
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Platform Overview
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <StatCard
              icon={<Users className="h-5 w-5" />}
              label="Total Users"
              value={stats.totalUsers}
              subtext={`${stats.hostCount} hosts · ${stats.guestCount} guests`}
              color="blue"
            />
            <StatCard
              icon={<MapPin className="h-5 w-5" />}
              label="Active Spots"
              value={stats.activeSpots}
              subtext={`${stats.totalSpots} total listed`}
              color="green"
            />
            <StatCard
              icon={<DollarSign className="h-5 w-5" />}
              label="Platform Revenue"
              value={formatCurrency(stats.totalRevenue)}
              subtext="15% fee from paid bookings"
              color="purple"
            />
            <StatCard
              icon={<Calendar className="h-5 w-5" />}
              label="Completed Bookings"
              value={stats.completedBookings}
              subtext={`${stats.pendingBookings} pending`}
              color="amber"
            />
          </div>
        </div>
      )}

      {/* ═══ Spot Moderation Table ═══ */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Spot Moderation
        </h2>

        {loading && spots.length === 0 ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-parkga-600" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">
                    Spot
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">
                    Host
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">
                    Price
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">
                    Bookings
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {spots.map((spot) => (
                  <tr
                    key={spot.id}
                    className={`transition-colors hover:bg-gray-50 ${
                      !spot.active ? "bg-red-50/50" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <Link
                          href={`/listings/${spot.id}`}
                          className="font-medium text-gray-900 hover:text-parkga-600"
                        >
                          {spot.title}
                        </Link>
                        <span className="mt-0.5 text-xs text-gray-400">
                          {spot.address}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {spot.host_name}
                    </td>
                    <td className="px-4 py-3">
                      {spot.price_per_hour && (
                        <span className="text-gray-700">
                          ${spot.price_per_hour}/hr
                        </span>
                      )}
                      {spot.price_per_hour && spot.price_per_event && (
                        <span className="text-gray-300"> · </span>
                      )}
                      {spot.price_per_event && (
                        <span className="text-gray-700">
                          ${spot.price_per_event}/event
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {spot.bookings_count ?? 0}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {spot.active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                          <CheckCircle className="h-3 w-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                          <XCircle className="h-3 w-3" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleSpotActive(spot.id, spot.active)}
                        disabled={togglingSpot === spot.id}
                        className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                          spot.active
                            ? "border border-red-200 text-red-600 hover:bg-red-50"
                            : "border border-brand-200 text-brand-600 hover:bg-brand-50"
                        }`}
                      >
                        {togglingSpot === spot.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : spot.active ? (
                          <XCircle className="h-3 w-3" />
                        ) : (
                          <CheckCircle className="h-3 w-3" />
                        )}
                        {spot.active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {spots.length === 0 && (
              <div className="py-12 text-center text-sm text-gray-500">
                No spots found.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stat Card Component ───────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext: string;
  color: "blue" | "green" | "purple" | "amber";
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-brand-50 text-brand-600",
    purple: "bg-purple-50 text-purple-600",
    amber: "bg-amber-50 text-amber-600",
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorMap[color]}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
          <p className="mt-0.5 text-[10px] text-gray-400">{subtext}</p>
        </div>
      </div>
    </div>
  );
}
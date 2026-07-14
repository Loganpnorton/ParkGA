"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  MapPin,
  Clock,
  DollarSign,
  Car,
  Star,
  Navigation,
  Loader2,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Calendar,
  CalendarClock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  PersonStanding,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "mapbox-gl/dist/mapbox-gl.css";

// Dynamic map imports (SSR disabled for WebGL)
const Map = dynamic(
  () => import("react-map-gl/mapbox").then((mod) => mod.default),
  { ssr: false },
);
const Marker = dynamic(
  () => import("react-map-gl/mapbox").then((mod) => mod.Marker),
  { ssr: false },
);
const Popup = dynamic(
  () => import("react-map-gl/mapbox").then((mod) => mod.Popup),
  { ssr: false },
);

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

// ─── Types ─────────────────────────────────────────────────────────────
interface Spot {
  id: string;
  host_id: string;
  title: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  price_per_hour: number | null;
  price_per_event: number | null;
  features: Record<string, boolean>;
  images: string[];
  created_at: string;
}

interface Profile {
  name: string | null;
  avatar_url: string | null;
}

// Truist Park center coordinates
const TRUIST_CENTER = { latitude: 33.8905, longitude: -84.468, zoom: 14 };

// ─── SpotHero-style Popup Card ─────────────────────────────────────────
function SpotHeroPopupCard({
  spot,
  onClose,
}: {
  spot: Spot;
  onClose: () => void;
}) {
  const [imageIndex, setImageIndex] = useState(0);
  const images = spot.images ?? [];
  const hasMultiple = images.length > 1;

  const prevImage = () =>
    setImageIndex((i) => (i - 1 + images.length) % images.length);
  const nextImage = () =>
    setImageIndex((i) => (i + 1) % images.length);

  const price = spot.price_per_hour ?? spot.price_per_event ?? 0;
  const priceLabel = spot.price_per_hour ? "/hr" : "/event";

  return (
    <div className="w-72 overflow-hidden rounded-xl border border-gray-200 bg-white text-gray-900">
      {/* ── Image section ───────────────────────────────────────────── */}
      <div className="relative h-40 w-full">
        {images.length > 0 ? (
          <img
            src={images[imageIndex]}
            alt={spot.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-100">
            <Car className="h-10 w-10 text-gray-300" />
          </div>
        )}

        {/* Close button — top-right */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-white/80 text-gray-600 shadow transition-colors hover:bg-white hover:text-gray-900"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Image carousel arrows — middle-left / middle-right */}
        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={prevImage}
              className="absolute left-2 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-gray-600 shadow transition-colors hover:bg-white hover:text-gray-900"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={nextImage}
              className="absolute right-2 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-gray-600 shadow transition-colors hover:bg-white hover:text-gray-900"
              aria-label="Next image"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        {/* Image count pill — bottom-center */}
        {images.length > 0 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2.5 py-0.5 text-[11px] font-medium text-white/90">
            {imageIndex + 1}/{images.length}
          </div>
        )}
      </div>

      {/* ── Details section ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 p-4">
        {/* Row 1 — Title + Price */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-lg font-bold leading-tight text-gray-900">
            {spot.title}
          </h3>
          <span className="shrink-0 text-xl font-bold text-gray-900">
            ${price}
          </span>
        </div>

        {/* Row 2 — Walking distance + Subtotal /hr */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5 text-gray-500">
            <PersonStanding className="h-4 w-4" />
            <span>10 min (0.5 mi)</span>
          </div>
          <span className="text-gray-400">{priceLabel}</span>
        </div>

        {/* Row 3 — Rating + Book Now */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span>4.5 (12)</span>
          </div>
          <Link
            href={`/listings/${spot.id}`}
            className="rounded-lg bg-parkga-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-parkga-700 min-h-[44px] flex items-center"
          >
            Book Now
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Spot Card ─────────────────────────────────────────────────────────
function SpotCard({
  spot,
  hostName,
  onSelect,
  isSelected,
}: {
  spot: Spot;
  hostName: string;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const hasHourly = spot.price_per_hour !== null;
  const hasEvent = spot.price_per_event !== null;
  const featureKeys = Object.entries(spot.features)
    .filter(([, v]) => v)
    .map(([k]) => k);
  const [expanded, setExpanded] = useState(isSelected);

  useEffect(() => {
    if (isSelected) setExpanded(true);
  }, [isSelected]);

  return (
    <div
      className={`rounded-xl border transition-all ${
        isSelected
          ? "border-parkga-500 bg-parkga-50 shadow-md"
          : "border-gray-200 bg-white hover:shadow-md"
      }`}
    >
      <button
        type="button"
        onClick={() => {
          onSelect();
          setExpanded(!expanded);
        }}
        className="flex w-full items-start gap-4 p-4 text-left"
      >
        {/* Thumbnail placeholder */}
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
          {spot.images && spot.images.length > 0 ? (
            <img
              src={spot.images[0]}
              alt={spot.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <Car className="h-8 w-8 text-gray-300" />
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
              {spot.title}
            </h3>
            <div className="shrink-0 text-right">
              {hasHourly && (
                <p className="text-sm font-bold text-parkga-600">
                  ${spot.price_per_hour}
                  <span className="text-xs font-normal text-gray-500">/hr</span>
                </p>
              )}
              {hasEvent && (
                <p className="text-xs text-gray-500">
                  ${spot.price_per_event}
                  <span className="text-gray-400">/event</span>
                </p>
              )}
            </div>
          </div>

          <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
            <MapPin className="h-3 w-3" />
            {spot.address.length > 35
              ? spot.address.slice(0, 35) + "..."
              : spot.address}
          </p>

          {/* Feature chips */}
          {featureKeys.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {featureKeys.slice(0, 3).map((k) => (
                <span
                  key={k}
                  className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600"
                >
                  {k.replace(/_/g, " ")}
                </span>
              ))}
              {featureKeys.length > 3 && (
                <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
                  +{featureKeys.length - 3}
                </span>
              )}
            </div>
          )}

          <p className="mt-1 text-[10px] text-gray-400">Host: {hostName}</p>
        </div>

        {/* Expand toggle */}
        <div className="shrink-0 pt-1">
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded description */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3">
          <p className="text-sm text-gray-600 line-clamp-3">{spot.description}</p>
          <div className="mt-3 flex items-center gap-2">
            <Link
              href={`/listings/${spot.id}`}
              className="rounded-lg bg-parkga-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-parkga-700 min-h-[44px] flex items-center"
            >
              Book Now
            </Link>
            {hasHourly && hasEvent && (
              <span className="text-xs text-gray-400">
                ${spot.price_per_hour}/hr or ${spot.price_per_event}/event
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Search Page ───────────────────────────────────────────────────────
export default function ListingsPage() {
  const supabase = createClient();

  const [spots, setSpots] = useState<Spot[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showMobileMap, setShowMobileMap] = useState(false);

  // Map viewport bounds — updated on every pan/zoom
  const [mapBounds, setMapBounds] = useState<{
    north: number;
    south: number;
    east: number;
    west: number;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Availability filter state
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [filterActive, setFilterActive] = useState(false);
  const [checkingAvail, setCheckingAvail] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);

  // ── Read bounds from a Mapbox GL map instance ────────────────────
  const setBoundsFromMap = useCallback((map: mapboxgl.Map) => {
    const bounds = map.getBounds();
    if (!bounds) return;
    setMapBounds({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    });
  }, []);

  // ── Track map viewport bounds on pan/zoom ────────────────────────
  const handleMapMove = useCallback(
    (e: { target: mapboxgl.Map }) => {
      setBoundsFromMap(e.target);
    },
    [setBoundsFromMap],
  );

  // ── Fetch spots on mount ─────────────────────────────────────────
  useEffect(() => {
    async function fetchSpots() {
      const { data, error } = await supabase
        .from("spots")
        .select("*")
        .order("price_per_hour", { ascending: true });

      if (error) {
        console.error("Failed to fetch spots:", error);
        return;
      }

      setSpots(data ?? []);

      // Fetch host names
      const hostIds = [...new Set((data ?? []).map((s) => s.host_id))];
      if (hostIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", hostIds);

        if (profileData) {
          const nameMap: Record<string, string> = {};
          profileData.forEach((p) => {
            nameMap[p.id] = p.name ?? "Unknown Host";
          });
          setProfiles(nameMap);
        }
      }

      setLoading(false);
    }

    fetchSpots();
  }, [supabase]);

  // ── Check availability via RPC ──────────────────────────────────
  async function checkAvailability() {
    setAvailError(null);

    if (!startDate || !endDate) {
      setAvailError("Please select both start and end dates.");
      return;
    }

    const p_start = `${startDate}T${startTime || "00:00"}:00Z`;
    const p_end = `${endDate}T${endTime || "23:59"}:00Z`;

    if (new Date(p_start) >= new Date(p_end)) {
      setAvailError("End time must be after start time.");
      return;
    }

    setCheckingAvail(true);

    const { data, error } = await supabase.rpc("get_available_spots", {
      p_start_time: p_start,
      p_end_time: p_end,
    });

    if (error) {
      setAvailError(error.message);
      setCheckingAvail(false);
      return;
    }

    setSpots(data ?? []);
    setFilterActive(true);
    setCheckingAvail(false);
  }

  function clearAvailabilityFilter() {
    setStartDate("");
    setStartTime("");
    setEndDate("");
    setEndTime("");
    setFilterActive(false);
    setAvailError(null);
    setLoading(true);
    // Re-fetch all spots
    supabase
      .from("spots")
      .select("*")
      .order("price_per_hour", { ascending: true })
      .then(({ data }) => {
        setSpots(data ?? []);
        setLoading(false);
      });
  }

  // ── Filter / search ───────────────────────────────────────────────
  const filteredSpots = useMemo(() => {
    if (!searchQuery.trim()) return spots;
    const q = searchQuery.toLowerCase();
    return spots.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q),
    );
  }, [spots, searchQuery]);

  // ── Filter by visible map bounds ─────────────────────────────────
  const visibleSpots = useMemo(() => {
    if (!mapBounds) return filteredSpots;
    const { north, south, east, west } = mapBounds;
    return filteredSpots.filter(
      (s) =>
        s.lat >= south &&
        s.lat <= north &&
        s.lng >= west &&
        s.lng <= east,
    );
  }, [filteredSpots, mapBounds]);

  // ── Selected spot for map popup ──────────────────────────────────
  const selectedSpot = spots.find((s) => s.id === selectedSpotId);

  // ── Feature helper ────────────────────────────────────────────────
  const featureLabels: Record<string, string> = {
    covered: "Covered",
    secure: "Security",
    ev_charger: "EV Charger",
    "247_access": "24/7 Access",
    handicap: "Accessible",
    oversize: "Oversize",
    lighting: "Well Lit",
    gate: "Gated",
  };

  // ── Loading ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-parkga-600" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col lg:flex-row">
      {/* ── Left Panel: Search + List ──────────────────────────────── */}
      <div className={`flex w-full flex-col border-b border-gray-200 lg:w-[420px] lg:shrink-0 lg:border-b-0 lg:border-r ${showMobileMap ? "hidden lg:flex" : "flex"}`}>
        {/* Search header */}
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search spots, addresses..."
              className="block w-full rounded-lg border border-gray-300 py-2 pl-9 pr-8 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-parkga-500 focus:outline-none focus:ring-2 focus:ring-parkga-500/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center min-h-[44px] min-w-[44px] text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {visibleSpots.length} spot{visibleSpots.length !== 1 ? "s" : ""}{" "}
            {mapBounds ? "in this area" : "found near Truist Park"}
          </p>
        </div>

        {/* Availability filter */}
        <div className="border-b border-gray-100 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
              <CalendarClock className="h-3.5 w-3.5" />
              Check availability
            </div>
            {filterActive && (
              <button
                type="button"
                onClick={clearAvailabilityFilter}
                className="text-[10px] font-medium text-red-600 hover:text-red-700"
              >
                Clear filter
              </button>
            )}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-500">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-900 focus:border-parkga-500 focus:outline-none focus:ring-1 focus:ring-parkga-500/20 min-h-[44px]"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500">Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-900 focus:border-parkga-500 focus:outline-none focus:ring-1 focus:ring-parkga-500/20 min-h-[44px]"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-900 focus:border-parkga-500 focus:outline-none focus:ring-1 focus:ring-parkga-500/20 min-h-[44px]"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500">Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-900 focus:border-parkga-500 focus:outline-none focus:ring-1 focus:ring-parkga-500/20 min-h-[44px]"
              />
            </div>
          </div>
          {availError && (
            <p className="mt-1.5 flex items-center gap-1 text-[10px] text-red-600">
              <AlertCircle className="h-3 w-3" />
              {availError}
            </p>
          )}
          <button
            type="button"
            onClick={checkAvailability}
            disabled={checkingAvail}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-parkga-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-parkga-700 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]"
          >
            {checkingAvail ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Calendar className="h-3 w-3" />
            )}
            {filterActive ? "Re-check availability" : "Check availability"}
          </button>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {filteredSpots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-10 w-10 text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">No spots found</p>
              <p className="text-xs text-gray-400">
                Try a different search term
              </p>
            </div>
          ) : visibleSpots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MapPin className="h-10 w-10 text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">
                No spots found in this area
              </p>
              <p className="text-xs text-gray-400">
                Try zooming out or moving the map
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleSpots.map((spot) => (
                <div key={spot.id}>
                  <SpotCard
                    spot={spot}
                    hostName={profiles[spot.host_id] ?? "Host"}
                    onSelect={() =>
                      setSelectedSpotId(
                        selectedSpotId === spot.id ? null : spot.id,
                      )
                    }
                    isSelected={selectedSpotId === spot.id}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right Panel: Map ───────────────────────────────────────── */}
      <div className={`relative flex-1 ${!showMobileMap ? "hidden md:block" : "block"}`}>
        {MAPBOX_TOKEN && MAPBOX_TOKEN !== "your_mapbox_token_here" ? (
          <Map
            mapboxAccessToken={MAPBOX_TOKEN}
            initialViewState={TRUIST_CENTER}
            style={{ width: "100%", height: "100%" }}
            mapStyle="mapbox://styles/mapbox/streets-v12"
            onLoad={(e) => {
              setMapLoaded(true);
              setBoundsFromMap(e.target);
            }}
            onMoveEnd={handleMapMove}
            attributionControl={true}
          >
            {mapLoaded &&
              filteredSpots.map((spot) => {
                const isSelected = spot.id === selectedSpotId;
                const price = spot.price_per_hour
                  ? `$${spot.price_per_hour}`
                  : `$${spot.price_per_event}`;

                // ── Selected spot → render Popup (no Marker) ──
                if (isSelected) {
                  return (
                    <Popup
                      key={spot.id}
                      longitude={spot.lng}
                      latitude={spot.lat}
                      anchor="bottom"
                      offset={[0, -10]}
                      closeButton={false}
                      closeOnClick={false}
                    >
                      <SpotHeroPopupCard
                        spot={spot}
                        onClose={() => setSelectedSpotId(null)}
                      />
                    </Popup>
                  );
                }

                // ── Non-selected spot → small pill Marker ──
                return (
                  <Marker
                    key={spot.id}
                    longitude={spot.lng}
                    latitude={spot.lat}
                    anchor="bottom"
                    onClick={() => setSelectedSpotId(spot.id)}
                  >
                    <button
                      type="button"
                      className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-gray-900 shadow-lg transition-all hover:scale-110 hover:bg-gray-900 hover:text-white hover:shadow-xl min-h-[44px]"
                    >
                      {price}
                    </button>
                  </Marker>
                );
              })}
          </Map>
        ) : (
          <div className="flex h-full items-center justify-center bg-gray-50">
            <div className="text-center">
              <MapPin className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">
                Map requires a Mapbox token
              </p>
              <p className="text-xs text-gray-400">
                Set{" "}
                <code className="text-amber-600">NEXT_PUBLIC_MAPBOX_TOKEN</code>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Mobile Map/List Toggle FAB ──────────────────────────────── */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 md:hidden">
        <button
          type="button"
          onClick={() => setShowMobileMap(!showMobileMap)}
          className="flex items-center gap-2 rounded-full bg-gray-900 px-6 py-3 text-sm font-semibold text-white shadow-2xl transition-all hover:bg-gray-800 active:scale-95 min-h-[44px]"
        >
          {showMobileMap ? (
            <>
              <MapPin className="h-4 w-4" />
              List
            </>
          ) : (
            <>
              <Navigation className="h-4 w-4" />
              Map
            </>
          )}
        </button>
      </div>
    </div>
  );
}

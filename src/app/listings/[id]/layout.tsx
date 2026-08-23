import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://parkga.com";

/**
 * Generates Open Graph metadata for single listing pages.
 * This runs on the server so social link previews show the
 * spot photo, title, price, and star rating when shared.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  try {
    const supabase = await createClient();

    const { data: spot } = await supabase
      .from("spots")
      .select("title, description, images, price_per_hour, price_per_event")
      .eq("id", id)
      .single();

    if (!spot) {
      return {
        title: "Parking Spot Not Found | ParkGA",
        description: "This parking spot could not be found.",
      };
    }

    const priceDisplay = spot.price_per_hour
      ? `$${spot.price_per_hour}/hr`
      : spot.price_per_event
        ? `$${spot.price_per_event}/event`
        : null;

    const title = `${spot.title} - ParkGA`;
    const description = priceDisplay
      ? `Book "${spot.title}" from ${priceDisplay} on ParkGA. ${spot.description?.slice(0, 120) ?? ""}`
      : spot.description?.slice(0, 160) ?? "Book a parking spot on ParkGA.";

    const ogImage = spot.images?.[0]
      ? { url: spot.images[0], width: 1200, height: 630, alt: spot.title }
      : {
          url: `${SITE_URL}/og-default.png`,
          width: 1200,
          height: 630,
          alt: "ParkGA",
        };

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `${SITE_URL}/listings/${id}`,
        type: "website",
        siteName: "ParkGA",
        images: ogImage,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: ogImage.url ? [ogImage.url] : [],
      },
    };
  } catch {
    return {
      title: "ParkGA - Peer-to-Peer Parking Marketplace",
      description: "Find and list affordable parking spots across Georgia.",
    };
  }
}

export default function ListingLayout({ children }: Props) {
  return <>{children}</>;
}
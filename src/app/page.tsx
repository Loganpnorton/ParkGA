import Link from "next/link";
import { Search, Shield, DollarSign, MapPin } from "lucide-react";

const features = [
  {
    icon: MapPin,
    title: "Find Parking Anywhere",
    description:
      "Browse hundreds of verified parking spots near stadiums, airports, downtown areas, and more across Georgia.",
  },
  {
    icon: Shield,
    title: "Safe & Secure",
    description:
      "Every booking is protected. We verify hosts and provide secure payments so you can park with confidence.",
  },
  {
    icon: DollarSign,
    title: "Earn from Your Space",
    description:
      "Got an unused driveway, garage, or parking lot? List it on ParkGA and start earning passive income today.",
  },
  {
    icon: Search,
    title: "Easy Booking",
    description:
      "Search by location, date, and price. Book instantly with a few taps. No hassle, no hidden fees.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-parkga-50 via-white to-parkga-100">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              Find Parking in
              <span className="block text-parkga-600">Georgia</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              ParkGA is the peer-to-peer marketplace that connects drivers with
              affordable parking spots hosted by locals. Skip the expensive lots
              and park smarter.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link
                href="/listings"
                className="rounded-lg bg-parkga-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-parkga-700"
              >
                Find a Spot
              </Link>
              <Link
                href="/host/new"
                className="rounded-lg border border-gray-300 px-6 py-3 text-base font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                List Your Space
              </Link>
            </div>
          </div>
        </div>

        {/* Decorative background pattern */}
        <div className="absolute inset-0 -z-10 h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px]" />
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Why ParkGA?
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              We make parking simple for drivers and rewarding for hosts.
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-xl border border-gray-200 p-6 transition-shadow hover:shadow-md"
                >
                  <div className="inline-flex rounded-lg bg-parkga-100 p-3">
                    <Icon className="h-6 w-6 text-parkga-600" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-parkga-600 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to Get Started?
            </h2>
            <p className="mt-4 text-lg text-parkga-100">
              Join thousands of drivers and hosts across Georgia.
            </p>
            <div className="mt-8 flex items-center justify-center gap-4">
              <Link
                href="/auth/signup"
                className="rounded-lg bg-white px-6 py-3 text-base font-semibold text-parkga-600 transition-colors hover:bg-parkga-50"
              >
                Create an Account
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
import Link from "next/link";
import { Car } from "lucide-react";

const footerLinks = {
  product: {
    title: "Product",
    links: [
      { href: "/listings", label: "Browse Spots" },
      { href: "/how-it-works", label: "How It Works" },
      { href: "/host/new", label: "List Your Space" },
    ],
  },
  company: {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/blog", label: "Blog" },
    ],
  },
  support: {
    title: "Support",
    links: [
      { href: "/faq", label: "FAQ" },
      { href: "/safety", label: "Safety" },
      { href: "/terms", label: "Terms of Service" },
      { href: "/privacy", label: "Privacy Policy" },
    ],
  },
};

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <Car className="h-6 w-6 text-parkga-600" />
              <span className="text-lg font-bold tracking-tight text-gray-900">
                Park<span className="text-parkga-600">GA</span>
              </span>
            </Link>
            <p className="mt-3 text-sm text-gray-500">
              The peer-to-peer marketplace connecting drivers with affordable parking spots across Georgia.
            </p>
          </div>

          {/* Link Columns */}
          {Object.values(footerLinks).map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-gray-900">
                {section.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-500 transition-colors hover:text-parkga-600"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="mt-10 border-t border-gray-200 pt-6">
          <p className="text-center text-xs text-gray-400">
            &copy; {currentYear} ParkGA. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
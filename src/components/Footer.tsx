import Link from "next/link";
import Image from "next/image";

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
    <footer className="bg-brand-900">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/">
              <Image
                src="/logo-full.png"
                alt="ParkGA Logo"
                width={200}
                height={48}
                className="h-6 md:h-8 w-auto object-contain drop-shadow-sm hover:scale-105 transition-transform duration-200"
              />
            </Link>
            <p className="mt-3 text-sm text-brand-200">
              The peer-to-peer marketplace connecting drivers with affordable parking spots across Georgia.
            </p>
          </div>

          {/* Link Columns */}
          {Object.values(footerLinks).map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-brand-100">
                {section.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-brand-300 transition-colors hover:text-brand-400"
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
        <div className="mt-10 border-t border-brand-800 pt-6">
          <p className="text-center text-xs text-brand-400">
            &copy; {currentYear} ParkGA. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

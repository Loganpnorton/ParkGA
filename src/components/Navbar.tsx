"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Menu, X, ChevronDown, LayoutDashboard, User, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/listings", label: "Browse Spots" },
  { href: "/how-it-works", label: "How It Works" },
];

export default function Navbar() {
  const router = useRouter();
  const supabase = createClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", user.id)
          .single();

        setUserName(profile?.name ?? user.email ?? null);
      }
    }
    getUser();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        getUser();
      } else if (event === "SIGNED_OUT") {
        setUserName(null);
        setDropdownOpen(false);
      }
    });

    // Close dropdown on outside click
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      subscription.unsubscribe();
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setDropdownOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/">
          <Image
            src="/logo-full.png"
            alt="ParkGA Logo"
            width={200}
            height={48}
            className="h-8 md:h-10 w-auto object-contain drop-shadow-sm hover:scale-105 transition-transform duration-200"
          />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-parkga-600"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/host/new"
            className="rounded-lg bg-parkga-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-parkga-700"
          >
            List a Space
          </Link>
        </div>

        {/* Desktop Auth / User Dropdown */}
        <div className="hidden items-center gap-3 md:flex">
          {userName ? (
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-gray-100"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                  {userName.charAt(0).toUpperCase()}
                </span>
                <span className="max-w-[120px] truncate">{userName}</span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-xl border border-gray-200 bg-white shadow-lg">
                  <div className="p-1.5">
                    <Link
                      href="/dashboard"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-gray-50"
                    >
                      <LayoutDashboard className="h-4 w-4 text-slate-400" />
                      Dashboard
                    </Link>
                    <Link
                      href="/dashboard?tab=profile"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-gray-50"
                    >
                      <User className="h-4 w-4 text-slate-400" />
                      My Profile
                    </Link>
                    <hr className="my-1 border-gray-100" />
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Log Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-gray-100"
              >
                Log in
              </Link>
              <Link
                href="/auth/signup"
                className="rounded-lg bg-parkga-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-parkga-700"
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="inline-flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-gray-100 md:hidden min-h-[44px] min-w-[44px]"
          aria-label="Toggle mobile menu"
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="border-t border-gray-200 bg-white md:hidden">
          <div className="space-y-1 px-4 py-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-md px-3 py-3 text-base font-medium text-slate-600 transition-colors hover:bg-gray-50 hover:text-parkga-600 min-h-[44px] flex items-center"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/host/new"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-md bg-parkga-600 px-3 py-3 text-center text-base font-medium text-white transition-colors hover:bg-parkga-700 min-h-[44px] flex items-center justify-center"
            >
              List a Space
            </Link>
            <div className="border-t border-gray-100 pt-3">
              {userName ? (
                <>
                  <div className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                      {userName.charAt(0).toUpperCase()}
                    </span>
                    {userName}
                  </div>
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 rounded-md px-3 py-3 text-base font-medium text-slate-600 transition-colors hover:bg-gray-50 min-h-[44px]"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Link>
                  <Link
                    href="/dashboard?tab=profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 rounded-md px-3 py-3 text-base font-medium text-slate-600 transition-colors hover:bg-gray-50 min-h-[44px]"
                  >
                    <User className="h-4 w-4" />
                    My Profile
                  </Link>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleSignOut();
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-3 text-base font-medium text-red-600 transition-colors hover:bg-red-50 min-h-[44px]"
                  >
                    <LogOut className="h-4 w-4" />
                    Log Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block rounded-md px-3 py-3 text-base font-medium text-slate-600 transition-colors hover:bg-gray-50 min-h-[44px] flex items-center"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/auth/signup"
                    onClick={() => setMobileMenuOpen(false)}
                    className="mt-1 block rounded-md bg-parkga-600 px-3 py-3 text-center text-base font-medium text-white transition-colors hover:bg-parkga-700 min-h-[44px] flex items-center justify-center"
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

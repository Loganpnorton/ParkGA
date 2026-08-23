"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ShieldAlert } from "lucide-react";
import Link from "next/link";

/**
 * Admin guard layout.
 * Hardcoded admin emails are checked here. Only authorized admins can
 * access any route under /admin-portal.
 *
 * Update AUTHORIZED_EMAILS below with the actual admin email.
 */
const AUTHORIZED_EMAILS = ["host@parkga.com"];

export default function AdminPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const [status, setStatus] = useState<"loading" | "authorized" | "denied">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;
    async function checkAccess() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) {
        if (!cancelled) setStatus("denied");
        return;
      }

      if (AUTHORIZED_EMAILS.includes(user.email)) {
        if (!cancelled) setStatus("authorized");
      } else {
        if (!cancelled) setStatus("denied");
      }
    }
    checkAccess();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-parkga-600" />
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <ShieldAlert className="h-16 w-16 text-red-400" />
        <h1 className="mt-4 text-2xl font-bold text-gray-900">
          Access Denied
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          You do not have permission to access the admin portal.
        </p>
        <Link
          href="/"
          className="mt-6 rounded-lg bg-parkga-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-parkga-700"
        >
          Go Home
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}

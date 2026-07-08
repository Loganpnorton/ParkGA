"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { Car, Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/auth/update-password`,
      },
    );

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  // Success state
  if (success) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-parkga-100">
            <CheckCircle className="h-8 w-8 text-parkga-600" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
            Check your email
          </h1>
          <p className="mt-3 text-sm text-gray-600">
            We've sent a password reset link to{" "}
            <span className="font-semibold text-gray-900">{email}</span>.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Click the link in the email to reset your password. The link expires
            in 1 hour.
          </p>
          <Link
            href="/auth/login"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-parkga-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-parkga-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <Car className="h-8 w-8 text-parkga-600" />
            <span className="text-2xl font-bold tracking-tight text-gray-900">
              Park<span className="text-parkga-600">GA</span>
            </span>
          </Link>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
            Forgot password
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Enter your email and we'll send you a reset link
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error Alert */}
            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1.5 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 transition-colors focus:border-parkga-500 focus:outline-none focus:ring-2 focus:ring-parkga-500/20"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-lg bg-parkga-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-parkga-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending reset link...
                </>
              ) : (
                "Send reset link"
              )}
            </button>
          </form>
        </div>

        {/* Back to Login */}
        <p className="mt-6 text-center text-sm text-gray-600">
          Remember your password?{" "}
          <Link
            href="/auth/login"
            className="font-semibold text-parkga-600 hover:text-parkga-700"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
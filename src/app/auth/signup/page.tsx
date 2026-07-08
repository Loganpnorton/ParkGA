"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Car, Eye, EyeOff, Loader2, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // If email confirmation is disabled, redirect to home
    // If enabled, show a success message
    setSuccess(true);
    setLoading(false);
  }

  // Password strength indicators
  const passwordChecks = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Contains a number", met: /\d/.test(password) },
    { label: "Contains a letter", met: /[a-zA-Z]/.test(password) },
  ];

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
            We've sent a confirmation link to{" "}
            <span className="font-semibold text-gray-900">{email}</span>.
            Click the link to activate your account, and your profile will be
            created automatically.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Once confirmed, you can sign in and start using ParkGA.
          </p>
          <Link
            href="/auth/login"
            className="mt-8 inline-flex rounded-lg bg-parkga-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-parkga-700"
          >
            Go to sign in
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
            Create your account
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Join the peer-to-peer parking marketplace
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

            {/* Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700"
              >
                Full name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="mt-1.5 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 transition-colors focus:border-parkga-500 focus:outline-none focus:ring-2 focus:ring-parkga-500/20"
              />
            </div>

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

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-11 text-gray-900 placeholder-gray-400 transition-colors focus:border-parkga-500 focus:outline-none focus:ring-2 focus:ring-parkga-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Password Strength */}
              {password.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {passwordChecks.map((check) => (
                    <li
                      key={check.label}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span
                        className={
                          check.met
                            ? "text-parkga-600"
                            : "text-gray-400"
                        }
                      >
                        {check.met ? "✓" : "○"}
                      </span>
                      <span
                        className={
                          check.met
                            ? "text-parkga-600"
                            : "text-gray-500"
                        }
                      >
                        {check.label}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Terms */}
            <p className="text-xs text-gray-500">
              By creating an account, you agree to our{" "}
              <Link
                href="/terms"
                className="font-medium text-parkga-600 hover:text-parkga-700"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="font-medium text-parkga-600 hover:text-parkga-700"
              >
                Privacy Policy
              </Link>
              .
            </p>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-lg bg-parkga-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-parkga-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-gray-500">
                Your profile is created instantly
              </span>
            </div>
          </div>

          <p className="text-center text-xs text-gray-500">
            When you sign up, we automatically create your ParkGA profile. No
            extra steps needed.
          </p>
        </div>

        {/* Login Link */}
        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{" "}
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
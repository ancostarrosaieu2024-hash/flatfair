"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

function friendlyError(message) {
  if (/invalid login credentials/i.test(message)) return "Wrong email or password. Please try again.";
  if (/email not confirmed/i.test(message)) return "Your email isn't confirmed yet. Please contact the FlatFair team.";
  if (/already registered/i.test(message)) return "An account with this email already exists. Please log in instead.";
  return message;
}

export default function AuthForm({ mode }) {
  const isSignup = mode === "signup";
  const prefix = isSignup ? "signup" : "login";
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    let result;
    try {
      result = isSignup
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
    } catch {
      setLoading(false);
      return setError("Couldn't reach the server. Check your internet connection and try again.");
    }

    const { data, error } = result;
    setLoading(false);
    if (error) return setError(friendlyError(error.message));
    if (!data.session) {
      return setError(
        "Account created, but no session was returned. Turn off \"Confirm email\" in Supabase (Authentication > Sign In / Providers > Email)."
      );
    }
    router.push("/app");
  }

  return (
    <section className="auth">
      <h1>{isSignup ? "Create your account" : "Welcome back"}</h1>
      {!hydrated && (
        <p className="error js-warning" role="alert">
          This page didn't load properly in your browser. Please update your browser (for
          example Safari) to the latest version, or try another browser.
        </p>
      )}
      <form onSubmit={handleSubmit} className="form">
        <label>
          Email
          <input
            data-testid={`${prefix}-email`}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            data-testid={`${prefix}-password`}
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button data-testid={`${prefix}-submit`} type="submit" className="btn" disabled={loading}>
          {loading ? "Please wait…" : isSignup ? "Sign up" : "Log in"}
        </button>
      </form>
      <p className="muted small">
        {isSignup ? (
          <>Already have an account? <Link href="/login">Log in</Link></>
        ) : (
          <>New here? <Link href="/signup">Sign up</Link></>
        )}
      </p>
    </section>
  );
}

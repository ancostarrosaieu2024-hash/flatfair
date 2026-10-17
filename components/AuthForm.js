"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthForm({ mode }) {
  const isSignup = mode === "signup";
  const prefix = isSignup ? "signup" : "login";
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error } = isSignup
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) return setError(error.message);
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

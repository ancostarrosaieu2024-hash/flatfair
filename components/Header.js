"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Header() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <header className="header">
      <Link href="/" className="brand">
        FlatFair
      </Link>
      <nav className="nav">
        {!ready ? null : session ? (
          <>
            <Link href="/app">My flat</Link>
            <button data-testid="logout" className="btn btn-ghost" onClick={logout}>
              Log out
            </button>
          </>
        ) : (
          <Link href="/login">Log in</Link>
        )}
      </nav>
    </header>
  );
}

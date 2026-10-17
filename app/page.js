import Link from "next/link";

export default function Home() {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">For university students sharing a flat</p>
        <h1>Know who owes whom. No awkward chats.</h1>
        <p className="lead">
          FlatFair helps university students living with roommates track shared
          expenses so they know who owes whom.
        </p>
        <Link href="/signup" className="btn btn-large">
          Sign up free
        </Link>
        <p className="muted small">
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </section>

      <section className="features">
        <div className="card">
          <h2>1. Invite your roommates</h2>
          <p>Share your household's invite code. Only your flat can see its expenses.</p>
        </div>
        <div className="card">
          <h2>2. Add an expense</h2>
          <p>Groceries, Wi-Fi, cleaning supplies: say what it was, how much, who paid and who splits it.</p>
        </div>
        <div className="card">
          <h2>3. See who owes whom</h2>
          <p>FlatFair works out the balances so everyone knows who to pay back.</p>
        </div>
      </section>
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const money = (n) => `€${Number(n).toFixed(2)}`;

// Turns the expense list into "X owes Y €Z" lines.
function computeSettlements(expenses) {
  const net = {};
  for (const e of expenses) {
    const amount = Number(e.amount) || 0;
    const sharers = e.split_between || [];
    if (!amount || sharers.length === 0) continue;
    net[e.paid_by] = (net[e.paid_by] || 0) + amount;
    for (const id of sharers) net[id] = (net[id] || 0) - amount / sharers.length;
  }

  const debtors = Object.entries(net).filter(([, v]) => v < -0.005).map(([id, v]) => [id, -v]);
  const creditors = Object.entries(net).filter(([, v]) => v > 0.005);
  const result = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i][1], creditors[j][1]);
    result.push({ from: debtors[i][0], to: creditors[j][0], amount: pay });
    debtors[i][1] -= pay;
    creditors[j][1] -= pay;
    if (debtors[i][1] < 0.005) i++;
    if (creditors[j][1] < 0.005) j++;
  }
  return result;
}

export default function AppPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [household, setHousehold] = useState(null);
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [error, setError] = useState("");

  // Expense form
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [excluded, setExcluded] = useState([]); // roommates NOT splitting; default = everyone splits
  const [saving, setSaving] = useState(false);

  // Household settings
  const [inviteCode, setInviteCode] = useState("");
  const [myName, setMyName] = useState("");
  const [notice, setNotice] = useState("");

  const loadHousehold = useCallback(async () => {
    const { error: rpcError } = await supabase.rpc("ensure_household");
    if (rpcError) return setError(rpcError.message);

    const [h, m, e] = await Promise.all([
      supabase.from("households").select("id, name, invite_code").single(),
      supabase.from("household_members").select("user_id, display_name").order("joined_at"),
      supabase.from("expenses").select("*").order("created_at", { ascending: false }),
    ]);
    const firstError = h.error || m.error || e.error;
    if (firstError) return setError(firstError.message);

    setHousehold(h.data);
    setMembers(m.data);
    setExpenses(e.data);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return router.replace("/login");
      setUser(data.session.user);
      setPaidBy(data.session.user.id);
      loadHousehold();
    });
  }, [router, loadHousehold]);

  useEffect(() => {
    const me = members.find((m) => m.user_id === user?.id);
    if (me) setMyName(me.display_name);
  }, [members, user]);

  const nameOf = (id) =>
    members.find((m) => m.user_id === id)?.display_name || "Former flatmate";

  async function addExpense(e) {
    e.preventDefault();
    const text = description.trim();
    if (!text) return setError("Please describe the expense.");

    let splitBetween = members.map((m) => m.user_id).filter((id) => !excluded.includes(id));
    if (splitBetween.length === 0) splitBetween = members.map((m) => m.user_id);

    setError("");
    setSaving(true);
    const { error } = await supabase.from("expenses").insert({
      household_id: household.id,
      description: text,
      amount: Number(amount) || 0,
      paid_by: members.some((m) => m.user_id === paidBy) ? paidBy : user.id,
      split_between: splitBetween,
    });
    setSaving(false);
    if (error) return setError(error.message);

    setDescription("");
    setAmount("");
    setExcluded([]);
    loadHousehold();
  }

  async function deleteExpense(id) {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return setError(error.message);
    loadHousehold();
  }

  async function joinHousehold(e) {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setError("");
    setNotice("");
    const { error } = await supabase.rpc("join_household", { code: inviteCode });
    if (error) return setError(error.message);
    setInviteCode("");
    setPaidBy(user.id);
    setExcluded([]);
    setNotice("You joined the household.");
    loadHousehold();
  }

  async function saveName(e) {
    e.preventDefault();
    const name = myName.trim();
    if (!name) return;
    setError("");
    setNotice("");
    const { error } = await supabase
      .from("household_members")
      .update({ display_name: name })
      .eq("user_id", user.id);
    if (error) return setError(error.message);
    setNotice("Name saved.");
    loadHousehold();
  }

  function toggleSplit(id) {
    setExcluded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  if (!user || !household) {
    return error ? <p className="error" role="alert">{error}</p> : <p className="muted">Loading…</p>;
  }

  const settlements = computeSettlements(expenses);

  return (
    <div className="app">
      <section className="card">
        <h1>Add an expense</h1>
        <p className="muted small">{household.name} · {members.length} {members.length === 1 ? "member" : "members"}</p>
        <form onSubmit={addExpense} className="form">
          <label>
            What was it?
            <input
              data-testid="core-input"
              type="text"
              placeholder="e.g. Weekly groceries"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <div className="row">
            <label>
              Amount (€)
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label>
              Who paid?
              <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.user_id === user.id ? `${m.display_name} (you)` : m.display_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <fieldset className="split">
            <legend>Split between</legend>
            {members.map((m) => (
              <label key={m.user_id} className="check">
                <input
                  type="checkbox"
                  checked={!excluded.includes(m.user_id)}
                  onChange={() => toggleSplit(m.user_id)}
                />
                {m.user_id === user.id ? `${m.display_name} (you)` : m.display_name}
              </label>
            ))}
          </fieldset>
          {error && <p className="error" role="alert">{error}</p>}
          <button data-testid="core-submit" type="submit" className="btn" disabled={saving}>
            {saving ? "Saving…" : "Add expense"}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Who owes whom</h2>
        {settlements.length === 0 ? (
          <p className="muted">All square. Nobody owes anything yet.</p>
        ) : (
          <ul className="list">
            {settlements.map((s, idx) => (
              <li key={idx} className="settle">
                <strong>{nameOf(s.from)}</strong> owes <strong>{nameOf(s.to)}</strong> {money(s.amount)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Household expenses</h2>
        {expenses.length === 0 ? (
          <p className="muted">No expenses yet. Add the first one above.</p>
        ) : (
          <ul className="list">
            {expenses.map((exp) => (
              <li key={exp.id} data-testid="core-item" className="item">
                <div className="item-main">
                  <span className="item-title">{exp.description}</span>
                  <span className="muted small">
                    {nameOf(exp.paid_by)} paid · split between{" "}
                    {exp.split_between.map(nameOf).join(", ")}
                  </span>
                </div>
                <div className="item-side">
                  <span className="amount">{money(exp.amount)}</span>
                  {exp.user_id === user.id && (
                    <button
                      className="btn btn-ghost btn-small"
                      onClick={() => deleteExpense(exp.id)}
                      aria-label={`Delete ${exp.description}`}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Your household</h2>
        <p>
          Invite your roommates: they sign up, then enter this code.
          <br />
          Invite code: <strong className="code">{household.invite_code}</strong>
        </p>
        <p className="muted small">
          Members: {members.map((m) => m.display_name).join(", ")}
        </p>
        {notice && <p className="notice" role="status">{notice}</p>}
        <form onSubmit={joinHousehold} className="form inline-form">
          <label>
            Join a roommate's household
            <input
              type="text"
              placeholder="Invite code"
              autoCapitalize="characters"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
          </label>
          <button type="submit" className="btn btn-ghost">Join</button>
        </form>
        <form onSubmit={saveName} className="form inline-form">
          <label>
            Your name in this household
            <input type="text" maxLength={40} value={myName} onChange={(e) => setMyName(e.target.value)} />
          </label>
          <button type="submit" className="btn btn-ghost">Save name</button>
        </form>
      </section>
    </div>
  );
}

import React, { useEffect, useState, useRef, useMemo } from "react";
import "../styles/page1.css";
import { supabase } from "../services/supabaseClient";

function Page1() {
  const [emailId, setEmailId] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState(""); // empty string represents null
  // created_by removed from schema; no user tracking stored in table
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  // For update/details section
  const [found, setFound] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(""); // empty string represents null
  const [updating, setUpdating] = useState(false);

  // For bulk status update (new)
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkAgeCompare, setBulkAgeCompare] = useState("older"); // 'older' | 'newer'
  const [bulkFromStatuses, setBulkFromStatuses] = useState([]); // ["", "active", "not visited", ...]
  const [bulkTargetStatus, setBulkTargetStatus] = useState(""); // "" => null

  // accounts list for dropdown
  const [accountsList, setAccountsList] = useState([]);
  const [listOpen, setListOpen] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const listRef = useRef(null);

  // removed created_by collection (no longer stored)

  useEffect(() => {
    fetchAccountsList();

    // close dropdown on outside click
    const onDoc = (e) => {
      if (listRef.current && !listRef.current.contains(e.target)) {
        setListOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAccountsList = async () => {
    setLoadingList(true);
    try {
      // use email_id as the identifier (no `id` column in your table)
      const { data, error } = await supabase
        .from("accounts")
        .select("email_id,status,created_at,password")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      setAccountsList(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("fetchAccountsList:", e);
      setAccountsList([]);
    } finally {
      setLoadingList(false);
    }
  };

  // Distinct status values from current list (include null as "")
  const distinctStatuses = useMemo(() => {
    const s = new Set();
    for (const acc of accountsList) s.add(acc.status ?? "");
    return Array.from(s);
  }, [accountsList]);

  const clearMessages = () => {
    setMsg(null);
    setErr(null);
  };

  const handleAddAccount = async (e) => {
    e.preventDefault();
    clearMessages();

    // no created_by requirement anymore
    if (!emailId?.trim()) {
      setErr("Please provide an email or identifier.");
      return;
    }
    if (!password) {
      setErr("Please provide a password.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        email_id: emailId.trim(),
        password,
        status: status || null,
      };
  const { data, error } = await supabase.from("accounts").insert([payload]).select();
      if (error) throw error;
      setMsg("Account saved to database.");
      setEmailId("");
      setPassword("");
    setStatus("");
      fetchAccountsList();
    } catch (e) {
      setErr(e?.message || "Failed to save account.");
    } finally {
      setLoading(false);
      setTimeout(() => {
        setMsg(null);
        setErr(null);
      }, 4000);
    }
  };

  // fetch full record by email_id (not id)
  const selectAccount = async (acc) => {
    if (!acc?.email_id) return;
    setListOpen(false);
    clearMessages();
    setFetching(true);
    try {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("email_id", acc.email_id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setErr("Selected account not found.");
        setFound(null);
      } else {
    setFound(data);
    setUpdateStatus(data.status ?? "");
      }
    } catch (e) {
      setErr(e?.message || "Failed to fetch account.");
    } finally {
      setFetching(false);
    }
  };

  // Update selected account: use email_id to match row
  const handleUpdateAccount = async (e) => {
    e?.preventDefault();
    clearMessages();
    if (!found) {
      setErr("No account selected to update.");
      return;
    }

    // created_by removed; no gating needed

    setUpdating(true);
    try {
      const updates = { status: updateStatus || null };

      const { data, error } = await supabase
        .from("accounts")
        .update(updates)
        .eq("email_id", found.email_id)
        .select()
        .maybeSingle();

      if (error) throw error;
      setFound(data);
      setMsg("Account updated successfully.");
      fetchAccountsList();
    } catch (e) {
      setErr(e?.message || "Failed to update account.");
    } finally {
      setUpdating(false);
      setTimeout(() => {
        setMsg(null);
        setErr(null);
      }, 4000);
    }
  };

  // Bulk update with age filter and status checklist
  const handleBulkUpdate = async () => {
    clearMessages();

    const confirmed = window.confirm(
      `This will change ${bulkFromStatuses.map(v => v === "" ? "null" : v).join(", ")} accounts to "${bulkTargetStatus || "null"}" for ${bulkAgeCompare === "older" ? "older than" : "newer than"} 24 hours. Continue?`
    );
    if (!confirmed) return;

    setBulkUpdating(true);
    try {
      // Calculate 24 hours ago timestamp
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
      const timestamp = twentyFourHoursAgo.toISOString();

      const applyAge = (q) => bulkAgeCompare === "older" ? q.lt("created_at", timestamp) : q.gte("created_at", timestamp);

      let totalUpdated = 0;
      const nonNull = bulkFromStatuses.filter((v) => v !== "");
      const includesNull = bulkFromStatuses.includes("");

      if (nonNull.length) {
        const { data, error } = await applyAge(
          supabase
            .from("accounts")
            .update({ status: bulkTargetStatus || null })
            .in("status", nonNull)
        ).select();
        if (error) throw error;
        totalUpdated += data ? data.length : 0;
      }

      if (includesNull) {
        const { data, error } = await applyAge(
          supabase
            .from("accounts")
            .update({ status: bulkTargetStatus || null })
            .is("status", null)
        ).select();
        if (error) throw error;
        totalUpdated += data ? data.length : 0;
      }

      setMsg(`Successfully updated ${totalUpdated} accounts (${bulkAgeCompare === "older" ? "older than" : "newer than"} 24h) to "${bulkTargetStatus || "null"}".`);
      fetchAccountsList();
    } catch (e) {
      setErr(e?.message || "Failed to perform bulk update.");
    } finally {
      setBulkUpdating(false);
      setTimeout(() => {
        setMsg(null);
        setErr(null);
      }, 6000);
    }
  };

  return (
    <div className="page1">
      <div className="hero">
        <div className="card">
          <h2>Quick guide — create a LinkedIn account (using temporary email/phone)</h2>

          <ol>
            <li>Open a temporary email provider (e.g., temp-mail.org) or use a temp phone SMS service.</li>
            <li>Go to https://www.linkedin.com and click "Join now".</li>
            <li>Enter the temporary email or temp phone number, full name and an easy-to-remember password (you will store it below).</li>
            <li>Complete the verification step (confirm via the temp email inbox or SMS code).</li>
            <li>Finish setup: add a profile photo later if desired. Keep the temporary address as backup.</li>
            <li>After the account is created, add the account's email and password to the form below to save it in the "accounts" table.</li>
          </ol>

          {/* <p className="muted" style={{ marginTop: 8 }}>
            Note: temporary accounts can be useful for testing. Storing passwords in plaintext is insecure — consider hashing/encryption for production.
          </p> */}

          {/* accounts dropdown (color coded) */}
          <div style={{ marginTop: 12 }} ref={listRef}>
            <div className="accounts-dropdown">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setListOpen((s) => !s)}
                aria-expanded={listOpen}
              >
                {listOpen ? "Close accounts" : `Accounts (${accountsList.length})`}
              </button>

              <button
                type="button"
                className="btn btn-ghost"
                onClick={fetchAccountsList}
                style={{ marginLeft: 8 }}
              >
                Refresh
              </button>

              {listOpen && (
                <div className="accounts-list" role="list">
                  {loadingList && <div className="muted" style={{ padding: 8 }}>Loading…</div>}
                  {!loadingList && accountsList.length === 0 && (
                    <div className="muted" style={{ padding: 8 }}>No accounts found</div>
                  )}
                  {!loadingList && accountsList.map((acc) => {
                    const statusClass = ((acc.status ?? 'none') + '')
                      .toLowerCase()
                      .replace(/\s+/g, '-');
                    return (
                      <button
                        key={acc.email_id}
                        type="button"
                        className={`account-item ${statusClass}`}
                        onClick={() => selectAccount(acc)}
                        role="listitem"
                        aria-label={`Select ${acc.email_id}, status ${acc.status ?? "null"}`}
                      >
                        <span className="account-name">{acc.email_id}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span className={`status-dot ${statusClass}`} aria-hidden="true"></span>
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>
                            {acc.created_at ? new Date(acc.created_at).toLocaleString() : ""}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                  <div className="accounts-note" aria-hidden="true">
                    <div className="legend"><span className="dot dot--active"></span> active</div>
                    <div className="legend"><span className="dot dot--not-visited"></span> not visited</div>
                    <div className="legend"><span className="dot dot--none"></span> null</div>
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* end accounts dropdown */}

          {/* Bulk update section (new) */}
          <div className="card" style={{ marginTop: 18, backgroundColor: "#fef3c7", border: "1px solid #f59e0b" }}>
            <h3 style={{ color: "#92400e", marginBottom: 12 }}>Bulk Update</h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Age filter */}
              <label style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, color: "#78350f" }}>Choose created date range:</span>
                <select
                  className="status-select"
                  value={bulkAgeCompare}
                  onChange={(e) => setBulkAgeCompare(e.target.value)}
                  style={{ minWidth: 220 }}
                >
                  <option value="older">Older than 24 hours</option>
                  <option value="newer">Newer than 24 hours</option>
                </select>
              </label>

              {/* Change X accounts to Y */}
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                <span style={{ color: "#78350f", lineHeight: "28px" }}>Change</span>

                {/* Checklist of current statuses */}
                <div style={{ border: '1px solid rgba(11,22,50,0.06)', borderRadius: 10, padding: 10, background: '#fff', maxHeight: 180, overflow: 'auto', minWidth: 220 }}>
                  {(() => {
                    const items = ["", ...distinctStatuses.filter(v => v !== "").sort((a,b)=>a.localeCompare(b))];
                    const toggle = (val) => {
                      setBulkFromStatuses((prev) => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
                    };
                    return (
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
                        {items.map((v) => (
                          <li key={v || 'null'} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                              id={`bulk-status-${v || 'null'}`}
                              type="checkbox"
                              checked={bulkFromStatuses.includes(v)}
                              onChange={() => toggle(v)}
                            />
                            <label htmlFor={`bulk-status-${v || 'null'}`} style={{ cursor: 'pointer' }}>
                              {v || 'null'}
                            </label>
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                </div>

                <span style={{ color: "#78350f", lineHeight: "28px" }}>accounts to</span>

                <select
                  className="status-select"
                  value={bulkTargetStatus}
                  onChange={(e) => setBulkTargetStatus(e.target.value)}
                  style={{ minWidth: 180 }}
                >
                  <option value="">null</option>
                  <option value="not visited">not visited</option>
                  <option value="active">active</option>
                </select>
                
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleBulkUpdate}
                  disabled={bulkUpdating}
                  style={{ backgroundColor: "#f59e0b", borderColor: "#f59e0b" }}
                >
                  {bulkUpdating ? "Updating..." : "Apply"}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      <div className="card" style={{ marginTop: 18, maxWidth: 760, marginLeft: "auto", marginRight: "auto" }}>
  <h2>Save account to Supabase (accounts table)</h2>

        <form className="auth-form" onSubmit={handleAddAccount} style={{ marginTop: 8 }}>
          <label>
            Email (email_id)
            <input
              type="text"
              placeholder="email@example.com"
              value={emailId}
              onChange={(e) => setEmailId(e.target.value)}
              required
            />
          </label>

          <label>
            Password
            <input
              type="text"
              placeholder="Password (will be stored as provided)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <label>
            Status
            <select className="status-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">null</option>
              <option value="active">active</option>
              <option value="not visited">not visited</option>
            </select>
          </label>

          <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save to accounts"}
            </button>
          </div>

          {msg && <div className="form-success" style={{ marginTop: 12 }}>{msg}</div>}
          {err && <div className="form-error" style={{ marginTop: 12 }}>{err}</div>}
        </form>
      </div>

      {/* Update / Details section */}
      <div className="card" style={{ marginTop: 18, maxWidth: 760, marginLeft: "auto", marginRight: "auto" }}>
        <h2>Selected account details & update</h2>

        {fetching && <div className="muted">Loading selected account…</div>}

        {found ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ marginBottom: 8 }}>
              <strong>Email:</strong> {found.email_id}
            </div>
            <div style={{ marginBottom: 8 }}>
              <strong>Stored password:</strong> {found.password}
            </div>
            <div style={{ marginBottom: 8 }}>
              <strong>Current status:</strong> {found.status ?? "null"}
            </div>
            {/* created_by removed */}

            <form onSubmit={handleUpdateAccount} style={{ marginTop: 8 }}>
              <label>
                Set status
                <select className="status-select" value={updateStatus} onChange={(e) => setUpdateStatus(e.target.value)}>
                  <option value="">null</option>
                  <option value="active">active</option>
                  <option value="not visited">not visited</option>
                </select>
              </label>

              <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
                <button className="btn btn-primary" type="submit" disabled={updating}>
                  {updating ? "Updating..." : "Update"}
                </button>

                {/* created_by note removed */}
              </div>
            </form>
          </div>
        ) : (
          <div style={{ marginTop: 12, color: "#6b7280" }}>
            No account selected. Open the Accounts dropdown and pick an account to edit.
          </div>
        )}

        {msg && <div className="form-success" style={{ marginTop: 12 }}>{msg}</div>}
        {err && <div className="form-error" style={{ marginTop: 12 }}>{err}</div>}
      </div>
    </div>
  );
}

export default Page1;
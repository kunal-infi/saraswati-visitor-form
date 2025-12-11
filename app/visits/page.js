"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const emptyForm = {
  childName: "",
  className: "",
  fatherName: "",
  phoneNumber: "",
  email: "",
  visitorCount: "0",
  visitorType: "",
  visited: false,
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};

const requiredPassword = (process.env.NEXT_PUBLIC_VISITS_PASSWORD || "").trim();
const requiresPassword = requiredPassword.length > 0;
const authStorageKey = "visits-dashboard-auth";

export default function VisitsDashboard() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [formStatus, setFormStatus] = useState("");
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(!requiresPassword);
  const [authInput, setAuthInput] = useState("");
  const [authError, setAuthError] = useState("");

  const totalVisitors = useMemo(
    () => records.reduce((sum, item) => sum + Number(item.visitorCount || 0), 0),
    [records]
  );

  const fetchRecords = async (overrideSearch) => {
    if (requiresPassword && !isAuthorized) return;
    setLoading(true);
    setStatus("Fetching latest records...");
    try {
      const response = await axios.get("/api/visits", {
        params: { mode: "list", limit: 300, search: overrideSearch ?? search },
      });
      setRecords(response?.data?.records || []);
      setStatus("");
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        "Could not load records right now.";
      setStatus(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!requiresPassword) return;
    try {
      const stored = window.localStorage.getItem(authStorageKey);
      if (stored && stored === requiredPassword) {
        setIsAuthorized(true);
      }
    } catch (error) {
      console.warn("Could not read stored dashboard auth", error);
    }
  }, []);

  useEffect(() => {
    if (!isAuthorized) return;
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized]);

  const resetForm = () => {
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleInput = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormStatus(editingId ? "Updating record..." : "Creating record...");

    try {
      const payload = {
        ...formData,
        visitorCount: Number(formData.visitorCount || 0),
      };

      if (editingId) {
        await axios.put("/api/visits", { ...payload, id: editingId });
        setFormStatus("Record updated.");
      } else {
        await axios.post("/api/visits", payload);
        setFormStatus("Record created.");
      }

      resetForm();
      fetchRecords();
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        "Could not save this record.";
      setFormStatus(message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (record) => {
    setEditingId(record.id);
    setFormData({
      childName: record.childName || "",
      className: record.className || "",
      fatherName: record.fatherName || "",
      phoneNumber: record.phoneNumber || "",
      email: record.email || "",
      visitorCount: String(record.visitorCount ?? "0"),
      visitorType: record.visitorType || "",
      visited: Boolean(record.visited),
    });
    setFormStatus("");
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm("Delete this visit? This cannot be undone.");
    if (!confirmed) return;

    try {
      await axios.delete("/api/visits", { params: { id } });
      fetchRecords();
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        "Could not delete this record.";
      setStatus(message);
    }
  };

  const downloadCsv = async () => {
    try {
      const response = await axios.get("/api/visits", {
        params: { mode: "list", format: "csv", limit: 500 },
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.setAttribute("download", "visits.csv");
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        "Could not generate CSV right now.";
      setStatus(message);
    }
  };

  const handleAuthSubmit = (event) => {
    event.preventDefault();
    if (authInput.trim() === requiredPassword) {
      setIsAuthorized(true);
      setAuthError("");
      try {
        window.localStorage.setItem(authStorageKey, requiredPassword);
      } catch (error) {
        console.warn("Could not persist dashboard auth", error);
      }
      fetchRecords();
    } else {
      setAuthError("Incorrect password. Please try again.");
    }
  };

  if (requiresPassword && !isAuthorized) {
    return (
      <>
        <header className="hero">
          <div className="brand">
            <div className="brand-copy">
              <p className="eyebrow">Visitor database</p>
              <h1>Enter password to view</h1>
              <p className="subhead">
                This dashboard is restricted. Enter the dashboard password to continue.
              </p>
            </div>
          </div>
        </header>
        <main className="main">
          <section className="form-card side-card">
            <h3>Unlock visits</h3>
            <form className="stacked-form" onSubmit={handleAuthSubmit}>
              <label>
                Dashboard password
                <input
                  type="password"
                  name="password"
                  placeholder="Enter password"
                  value={authInput}
                  onChange={(event) => setAuthInput(event.target.value)}
                  required
                />
              </label>
              <button type="submit" disabled={!authInput.trim()}>
                Continue
              </button>
              {authError && (
                <div className="inline-status" role="status" aria-live="polite">
                  {authError}
                </div>
              )}
            </form>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <header className="hero">
        <div className="brand">
          <div className="brand-copy">
            <p className="eyebrow">Visitor database</p>
            <h1>Manage registrations</h1>
            <p className="subhead">
              Review every visitor entry, export a CSV, and keep records tidy.
            </p>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="records-layout">
          <section className="form-card table-card">
            <div className="table-head">
              <div>
                <h2>Visitor records</h2>
                <p className="lead">
                  Showing the latest sign-ups. Total accompanying visitors: {totalVisitors}.
                </p>
              </div>
              <div className="table-actions">
                <input
                  type="search"
                  name="search"
                  placeholder="Search name, phone, email"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") fetchRecords(event.target.value);
                  }}
                />
                <button type="button" className="ghost" onClick={() => fetchRecords()}>
                  Refresh
                </button>
                <button type="button" onClick={downloadCsv}>
                  Download CSV
                </button>
              </div>
            </div>

            <div className="table-wrapper">
              {loading ? (
                <p className="muted">Loading records...</p>
              ) : records.length === 0 ? (
                <p className="muted">No records found.</p>
              ) : (
                <table className="record-table">
                  <thead>
                    <tr>
                      <th>Visitor</th>
                      <th>Contact</th>
                      <th>Details</th>
                      <th>Created</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => (
                      <tr key={record.id}>
                        <td>
                          <div className="cell-stack">
                            <strong>{record.fatherName || "—"}</strong>
                            <span className="muted small">
                              {record.visitorType || "Unknown"}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="cell-stack">
                            <span>{record.phoneNumber || "—"}</span>
                            <span className="muted small">{record.email || "—"}</span>
                          </div>
                        </td>
                        <td>
                          <div className="cell-stack">
                            <span>
                              {record.childName || "N/A"}{" "}
                              {record.className ? `• ${record.className}` : ""}
                            </span>
                            <span className="muted small">
                              {record.visitorCount} accompanying
                            </span>
                          </div>
                        </td>
                        <td>{formatDate(record.createdAt)}</td>
                        <td>
                          <span className={`pill ${record.visited ? "success" : "info"}`}>
                            {record.visited ? "Visited" : "Not arrived"}
                          </span>
                        </td>
                        <td className="actions-cell">
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => startEdit(record)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="ghost danger"
                            onClick={() => handleDelete(record.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {status && (
              <div className="inline-status" role="status" aria-live="polite">
                {status}
              </div>
            )}
          </section>

          <section className="form-card side-card">
            <div className="side-head">
              <div>
                <p className="eyebrow">{editingId ? "Edit record" : "Create record"}</p>
                <h3>{editingId ? "Update visitor" : "Add visitor"}</h3>
              </div>
              {editingId && (
                <button type="button" className="ghost" onClick={resetForm}>
                  Cancel edit
                </button>
              )}
            </div>
            <form className="stacked-form" onSubmit={handleSubmit}>
              <label>
                Visitor name
                <input
                  type="text"
                  name="fatherName"
                  placeholder="Name of the visitor"
                  value={formData.fatherName}
                  onChange={handleInput}
                  required
                />
              </label>
              <label>
                Phone number
                <input
                  type="tel"
                  name="phoneNumber"
                  placeholder="+91 98765 43210"
                  value={formData.phoneNumber}
                  onChange={handleInput}
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  name="email"
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={handleInput}
                  required
                />
              </label>
              <div className="two-col">
                <label>
                  Visitor type
                  <select
                    name="visitorType"
                    value={formData.visitorType}
                    onChange={handleInput}
                    required
                  >
                    <option value="" disabled>
                      Select one
                    </option>
                    <option value="Parent">Parent</option>
                    <option value="Visitor">Visitor</option>
                    <option value="Alumnus">Alumnus</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
                <label>
                  Accompanying visitors
                  <input
                    type="number"
                    name="visitorCount"
                    min="0"
                    max="20"
                    value={formData.visitorCount}
                    onChange={handleInput}
                    required
                  />
                </label>
              </div>
              <div className="two-col">
                <label>
                  Child name
                  <input
                    type="text"
                    name="childName"
                    placeholder="Student name"
                    value={formData.childName}
                    onChange={handleInput}
                    required={formData.visitorType === "Parent"}
                  />
                </label>
                <label>
                  Class
                  <input
                    type="text"
                    name="className"
                    placeholder="e.g., Grade 5"
                    value={formData.className}
                    onChange={handleInput}
                    required={formData.visitorType === "Parent"}
                  />
                </label>
              </div>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  name="visited"
                  checked={formData.visited}
                  onChange={handleInput}
                />
                Marked as visited
              </label>
              <button type="submit" disabled={saving}>
                {editingId ? "Save changes" : "Add visitor"}
              </button>
              {formStatus && (
                <div className="inline-status" role="status" aria-live="polite">
                  {formStatus}
                </div>
              )}
            </form>
          </section>
        </div>
      </main>
    </>
  );
}

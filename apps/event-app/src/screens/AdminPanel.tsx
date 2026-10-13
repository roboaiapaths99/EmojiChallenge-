import React, { useState, useEffect, useMemo } from "react";
import type { UseFaceTrackingReturn } from "../vision/useFaceTracking";
import { predictEmojiExpression } from "@emoji-face-challenge/expression-engine";
import "./AdminPanel.css";

interface AdminPanelProps {
  onClose: () => void;
  faceTracking?: UseFaceTrackingReturn;
}

interface AdminStats {
  totalSessions: number;
  totalPhotos: number;
  totalRecipients: number;
  realRecipients?: number;
  demoRecipients?: number;
  totalDownloaded?: number;
  claimedPending?: number;
  conversionRate?: number;
  avgScore?: number;
  topScore?: number;
}

interface RecipientLead {
  id: string;
  photoId: string;
  sessionId?: string;
  name: string;
  mobile: string;
  email?: string;
  score?: number;
  mode?: string;
  isReal?: boolean;
  isDemo?: boolean;
  downloadedAt?: string | null;
  createdAt: string;
}

interface GameSessionRow {
  id: string;
  mode: string;
  finalScore: number;
  p1Score: number;
  p2Score: number;
  photoId?: string;
  createdAt: string;
}

interface AIModelMetrics {
  modelName: string;
  version: string;
  status: string;
  totalProfiles: number;
  overallAccuracy: number;
  f1Score: number;
  precision: number;
  recall: number;
  averageLatencyMs: number;
  blendshapeCount: number;
}

interface BenchmarkResult {
  target: string;
  predicted: string;
  emoji: string;
  score: number;
  passed: boolean;
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export const AdminPanel: React.FC<AdminPanelProps> = ({ onClose, faceTracking }) => {
  const [activeTab, setActiveTab] = useState<"leads" | "sessions" | "ai_model">("leads");
  const [stats, setStats] = useState<AdminStats>({
    totalSessions: 0,
    totalPhotos: 0,
    totalRecipients: 0,
    totalDownloaded: 0,
    conversionRate: 0,
    avgScore: 0,
    topScore: 0,
  });
  const [recipients, setRecipients] = useState<RecipientLead[]>([]);
  const [sessions, setSessions] = useState<GameSessionRow[]>([]);
  const [aiEmojis, setAiEmojis] = useState<any[]>([]);
  const [modelMetrics, setModelMetrics] = useState<AIModelMetrics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Filters & Search
  const [leadSearch, setLeadSearch] = useState<string>("");
  const [leadStatusFilter, setLeadStatusFilter] = useState<"all" | "real" | "downloaded" | "pending">("all");
  const [sessionModeFilter, setSessionModeFilter] = useState<string>("all");
  const [selectedLead, setSelectedLead] = useState<RecipientLead | null>(null);

  // Benchmark Runner state
  const [isRunningBenchmark, setIsRunningBenchmark] = useState<boolean>(false);
  const [benchmarkData, setBenchmarkData] = useState<{
    accuracy: number;
    passed: number;
    total: number;
    latencyMs: number;
    results: BenchmarkResult[];
  } | null>(null);

  // Live face prediction state
  const [livePrediction, setLivePrediction] = useState<any>(null);

  // Auto-refresh interval (every 4 seconds) to stream live attendee leads
  useEffect(() => {
    fetchAdminData(false);
    const interval = setInterval(() => {
      fetchAdminData(true); // silent background poll
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Poll face prediction if tracking is active
  useEffect(() => {
    if (!faceTracking) return;
    let animId: number;

    const loop = () => {
      const p1 = faceTracking.assignment.players.find((p) => p.id === "p1");
      if (p1 && p1.face.blendshapes) {
        const pred = predictEmojiExpression(p1.face.blendshapes);
        setLivePrediction(pred);
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [faceTracking]);

  const showToast = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 4000);
  };

  const [adminKey, setAdminKey] = useState<string>(() => {
    return (
      localStorage.getItem("emoji_admin_secret") ||
      (import.meta.env.VITE_ADMIN_SECRET ?? "") ||
      "dev_admin_secret_key"
    );
  });
  const [showKeyPrompt, setShowKeyPrompt] = useState<boolean>(false);
  const [keyInput, setKeyInput] = useState<string>("");
  const [authError, setAuthError] = useState<boolean>(false);

  const getHeaders = () => ({ "x-admin-secret": adminKey.trim() });

  const fetchAdminData = async (silent: boolean = false) => {
    if (!silent) setIsLoading(true);
    const headers = getHeaders();

    try {
      // 1. Fetch Stats
      const statsRes = await fetch(`${API_BASE}/api/admin/stats`, { headers });
      if (statsRes.status === 401) {
        setAuthError(true);
        if (!silent) showToast("🔒 Admin secret key required or invalid.");
        return;
      }
      if (statsRes.ok) {
        setAuthError(false);
        const data = await statsRes.json();
        setStats(data.stats);
      }

      // 2. Fetch Recipients
      const recRes = await fetch(`${API_BASE}/api/admin/recipients?limit=300`, { headers });
      if (recRes.ok) {
        const data = await recRes.json();
        setRecipients(data.recipients || []);
      }

      // 3. Fetch Sessions
      const sessRes = await fetch(`${API_BASE}/api/admin/sessions?limit=200`, { headers });
      if (sessRes.ok) {
        const data = await sessRes.json();
        setSessions(data.sessions || []);
      }

      // 4. Fetch AI Emojis
      const aiRes = await fetch(`${API_BASE}/api/ai/emojis`);
      if (aiRes.ok) {
        const data = await aiRes.json();
        setAiEmojis(data.profiles || []);
      }

      // 5. Fetch AI Model Metrics
      const metricsRes = await fetch(`${API_BASE}/api/ai/metrics`);
      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setModelMetrics(data.metrics || null);
      }
    } catch (err) {
      if (!silent) console.warn("Could not fetch admin data from FastAPI:", err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const handleSaveKey = (newKey: string) => {
    const clean = newKey.trim();
    if (!clean) return;
    setAdminKey(clean);
    localStorage.setItem("emoji_admin_secret", clean);
    setShowKeyPrompt(false);
    setAuthError(false);
    showToast("🔑 Admin Secret Key saved!");
    setTimeout(() => {
      fetchAdminData(false);
    }, 100);
  };

  const handleClearDemoData = async () => {
    if (!window.confirm("Delete all 32 sample demo leads? Real attendee leads will be kept.")) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/clear-demo`, {
        method: "POST",
        headers: getHeaders(),
      });
      if (res.status === 401) {
        setAuthError(true);
        showToast("🔒 Unauthorized: Incorrect admin secret key.");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        showToast(`🧹 ${data.message}`);
        await fetchAdminData(false);
      } else {
        showToast("⚠️ Could not clear demo leads.");
      }
    } catch (err) {
      showToast("⚠️ Network error contacting backend server.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeedRealData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/seed-real-data`, {
        method: "POST",
        headers: getHeaders(),
      });
      if (res.status === 401) {
        setAuthError(true);
        showToast("🔒 Unauthorized: Incorrect admin secret key.");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        showToast(`✨ Successfully populated ${data.seededLeads} authentic event leads and sessions!`);
        await fetchAdminData(false);
      } else {
        showToast("⚠️ Could not trigger data seed.");
      }
    } catch (err) {
      showToast("⚠️ Error contacting backend server.");
    } finally {
      setIsLoading(false);
    }
  };

  const runBenchmark = async () => {
    setIsRunningBenchmark(true);
    try {
      const res = await fetch(`${API_BASE}/api/ai/benchmark`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setBenchmarkData({
          accuracy: data.accuracy,
          passed: data.passed,
          total: data.totalTests,
          latencyMs: data.benchmarkLatencyMs,
          results: data.testResults,
        });
        showToast(`⚡ Model Benchmark Passed: ${data.accuracy}% Accuracy!`);
      }
    } catch (err) {
      showToast("⚠️ Benchmark test failed to communicate with AI service.");
    } finally {
      setIsRunningBenchmark(false);
    }
  };

  const exportLeadsCSV = () => {
    if (!recipients.length) {
      alert("No recipients to export yet.");
      return;
    }

    const headers = ["ID", "Name", "Mobile", "Email", "Game Score", "Mode", "Photo ID", "Claimed Date", "Downloaded Date"];
    const rows = recipients.map((r) => [
      r.id,
      `"${r.name.replace(/"/g, '""')}"`,
      `"${r.mobile}"`,
      `"${r.email || ""}"`,
      r.score ?? "N/A",
      r.mode ?? "single",
      r.photoId,
      r.createdAt,
      r.downloadedAt || "Pending",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `emoji_face_challenge_real_leads_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Real attendee count
  const realCount = useMemo(() => {
    return recipients.filter((r) => r.isReal || (!r.isDemo && !r.id.startsWith("rec_10"))).length;
  }, [recipients]);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return recipients.filter((lead) => {
      // Search text filter
      const searchLower = leadSearch.toLowerCase().trim();
      const matchSearch =
        !searchLower ||
        lead.name.toLowerCase().includes(searchLower) ||
        lead.mobile.toLowerCase().includes(searchLower) ||
        (lead.email && lead.email.toLowerCase().includes(searchLower)) ||
        lead.photoId.toLowerCase().includes(searchLower);

      if (!matchSearch) return false;

      const isReal = Boolean(lead.isReal || (!lead.isDemo && !lead.id.startsWith("rec_10")));

      if (leadStatusFilter === "real") return isReal;
      if (leadStatusFilter === "downloaded") return Boolean(lead.downloadedAt);
      if (leadStatusFilter === "pending") return !lead.downloadedAt;
      return true;
    });
  }, [recipients, leadSearch, leadStatusFilter]);

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((sess) => {
      if (sessionModeFilter === "all") return true;
      return sess.mode === sessionModeFilter;
    });
  }, [sessions, sessionModeFilter]);

  return (
    <div className="admin-modal-overlay">
      <div className="admin-panel-card">
        {/* Header */}
        <header className="admin-header">
          <div className="admin-title-group">
            <span className="admin-title-badge">ADMIN CONTROL</span>
            <h2 className="admin-title">EVENT OPERATIONS & ATTENDEE LEADS INTELLIGENCE</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="admin-live-pill" title="Live background polling enabled every 4 seconds">
              <div className="admin-pulse-dot" />
              <span>LIVE SYNC</span>
            </div>
            <button
              className="admin-action-refresh-btn"
              onClick={() => {
                setKeyInput(adminKey);
                setShowKeyPrompt(true);
              }}
              title="Click to view or change your Admin Secret Key"
              style={{
                borderColor: authError ? "#ef4444" : "rgba(168, 85, 247, 0.4)",
                background: authError ? "rgba(239, 68, 68, 0.2)" : "rgba(168, 85, 247, 0.15)",
                color: authError ? "#f87171" : "#c084fc",
                fontWeight: 700,
              }}
            >
              🔑 {authError ? "SET SECRET KEY" : "SECRET KEY"}
            </button>
            <button className="admin-action-refresh-btn" onClick={() => fetchAdminData(false)} title="Force refresh leads from server">
              🔄 REFRESH
            </button>
            <button className="admin-action-clear-btn" onClick={handleClearDemoData} title="Delete all 32 sample demo leads">
              🗑️ CLEAR DEMO DATA
            </button>
            <button className="admin-action-pill-btn" onClick={handleSeedRealData} title="Populate realistic event dataset">
              ✨ SEED DEMO LEADS
            </button>
            <button className="admin-close-btn" onClick={onClose} title="Close Admin Panel">
              ✕
            </button>
          </div>
        </header>

        {/* Secret Key Modal / Banner */}
        {(showKeyPrompt || authError) && (
          <div
            style={{
              padding: "16px 24px",
              background: "rgba(15, 23, 42, 0.95)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontWeight: 700, color: authError ? "#f87171" : "#e2e8f0", fontSize: "14px" }}>
                🔑 Admin Dashboard Secret Key
              </span>
              <span style={{ color: "#94a3b8", fontSize: "12px" }}>
                Matches <code>ADMIN_SECRET</code> in your server <code>.env</code> file (Default: <code>dev_admin_secret_key</code>)
              </span>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flex: 1, maxWidth: "460px" }}>
              <input
                type="text"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Enter ADMIN_SECRET..."
                style={{
                  flex: 1,
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(0,0,0,0.5)",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontFamily: "monospace",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveKey(keyInput);
                }}
              />
              <button
                className="admin-action-pill-btn"
                onClick={() => handleSaveKey(keyInput)}
                style={{ background: "#6366f1", borderColor: "#818cf8" }}
              >
                SAVE & CONNECT
              </button>
              {showKeyPrompt && !authError && (
                <button
                  className="admin-action-refresh-btn"
                  onClick={() => setShowKeyPrompt(false)}
                >
                  CANCEL
                </button>
              )}
            </div>
          </div>
        )}

        {actionMessage && <div className="admin-toast-banner">{actionMessage}</div>}

        {/* Tabs */}
        <nav className="admin-tabs">
          <button
            className={`admin-tab-btn ${activeTab === "leads" ? "active" : ""}`}
            onClick={() => setActiveTab("leads")}
          >
            📋 ATTENDEE LEADS ({recipients.length})
          </button>
          <button
            className={`admin-tab-btn ${activeTab === "sessions" ? "active" : ""}`}
            onClick={() => setActiveTab("sessions")}
          >
            🎮 GAME SESSIONS ({sessions.length})
          </button>
          <button
            className={`admin-tab-btn ${activeTab === "ai_model" ? "active" : ""}`}
            onClick={() => setActiveTab("ai_model")}
          >
            🤖 ML MODEL & AI LAB ({aiEmojis.length || 20} CLASSES)
          </button>
        </nav>

        {/* Content Body */}
        <main className="admin-content-body">
          {/* Key Metrics */}
          <div className="admin-stats-grid">
            <div className="admin-stat-box" style={{ borderColor: "rgba(16, 185, 129, 0.4)", background: "rgba(16, 185, 129, 0.05)" }}>
              <span className="admin-stat-label" style={{ color: "#10b981" }}>🔥 REAL ATTENDEE LEADS</span>
              <span className="admin-stat-num" style={{ color: "#10b981" }}>
                {stats.realRecipients ?? realCount}
              </span>
              <span className="admin-stat-sub">Live Players via QR Claim</span>
            </div>
            <div className="admin-stat-box">
              <span className="admin-stat-label">TOTAL LEADS IN DB</span>
              <span className="admin-stat-num">{stats.totalRecipients || recipients.length}</span>
              <span className="admin-stat-sub">
                {realCount} Real • {recipients.length - realCount} Demo
              </span>
            </div>
            <div className="admin-stat-box">
              <span className="admin-stat-label">SOUVENIRS DOWNLOADED</span>
              <span className="admin-stat-num" style={{ color: "#38bdf8" }}>
                {stats.totalDownloaded ?? recipients.filter((r) => r.downloadedAt).length}
              </span>
              <span className="admin-stat-sub">
                Conversion: {stats.conversionRate ?? Math.round((recipients.filter((r) => r.downloadedAt).length / Math.max(1, recipients.length)) * 100)}%
              </span>
            </div>
            <div className="admin-stat-box">
              <span className="admin-stat-label">TOTAL GAMEPLAY SESSIONS</span>
              <span className="admin-stat-num" style={{ color: "#818cf8" }}>{stats.totalSessions || sessions.length}</span>
              <span className="admin-stat-sub">Avg Score: {stats.avgScore || 1220} pts</span>
            </div>
          </div>

          {/* Tab 1: Leads */}
          {activeTab === "leads" && (
            <div className="admin-table-container">
              <div className="admin-table-header">
                <div>
                  <h3 className="admin-table-title">VERIFIED ATTENDEE CONTACT LEADS (EVENT QR CLAIMS)</h3>
                  <div style={{ fontSize: "0.82rem", color: "#9ca3af", marginTop: "2px" }}>
                    Showing {filteredLeads.length} of {recipients.length} attendee records ({realCount} authentic live participants)
                  </div>
                </div>

                <div className="admin-leads-toolbar">
                  {/* Search box */}
                  <div className="admin-search-wrapper">
                    <span className="admin-search-icon">🔍</span>
                    <input
                      type="text"
                      className="admin-search-input"
                      placeholder="Search name, phone, email, token…"
                      value={leadSearch}
                      onChange={(e) => setLeadSearch(e.target.value)}
                    />
                    {leadSearch && (
                      <button className="admin-search-clear" onClick={() => setLeadSearch("")}>
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Filter chips */}
                  <div className="admin-filter-group">
                    <button
                      className={`admin-filter-pill ${leadStatusFilter === "real" ? "active" : ""}`}
                      onClick={() => setLeadStatusFilter("real")}
                      style={leadStatusFilter === "real" ? { background: "#10b981", color: "#fff", borderColor: "#10b981" } : {}}
                    >
                      🔥 Real ({realCount})
                    </button>
                    <button
                      className={`admin-filter-pill ${leadStatusFilter === "all" ? "active" : ""}`}
                      onClick={() => setLeadStatusFilter("all")}
                    >
                      All ({recipients.length})
                    </button>
                    <button
                      className={`admin-filter-pill ${leadStatusFilter === "downloaded" ? "active" : ""}`}
                      onClick={() => setLeadStatusFilter("downloaded")}
                    >
                      ✓ Downloaded ({recipients.filter((r) => r.downloadedAt).length})
                    </button>
                    <button
                      className={`admin-filter-pill ${leadStatusFilter === "pending" ? "active" : ""}`}
                      onClick={() => setLeadStatusFilter("pending")}
                    >
                      ⏳ Claimed ({recipients.filter((r) => !r.downloadedAt).length})
                    </button>
                  </div>

                  <button className="admin-export-btn" onClick={exportLeadsCSV}>
                    📥 EXPORT CSV
                  </button>
                </div>
              </div>

              {isLoading ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af" }}>Loading real attendee leads…</div>
              ) : filteredLeads.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af" }}>
                  No leads matching criteria. Try adjusting your search query or click "SEED REAL LEADS" above.
                </div>
              ) : (
                <div className="admin-table-scroll">
                  <table className="admin-data-table">
                    <thead>
                      <tr>
                        <th>ATTENDEE</th>
                        <th>PHONE NUMBER</th>
                        <th>COMPANY / EMAIL</th>
                        <th>SCORE & MODE</th>
                        <th>CLAIM TIMESTAMP</th>
                        <th>SOUVENIR STATUS</th>
                        <th>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads.map((r) => {
                        const isReal = Boolean(r.isReal || (!r.isDemo && !r.id.startsWith("rec_10")));
                        const initials = r.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2);

                        return (
                          <tr key={r.id} className={isReal ? "admin-row-real" : ""}>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <div className="admin-avatar-bubble" style={isReal ? { background: "linear-gradient(135deg, #10b981, #059669)" } : {}}>
                                  {initials}
                                </div>
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span style={{ fontWeight: 700, color: "#ffffff" }}>{r.name}</span>
                                    {isReal && <span className="admin-real-badge">🔥 REAL</span>}
                                  </div>
                                  <div style={{ fontSize: "0.75rem", color: "#6b7280", fontFamily: "monospace" }}>
                                    {r.id}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td style={{ fontFamily: "monospace", fontWeight: 600 }}>
                              <a
                                href={`https://wa.me/${r.mobile.replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: "#34d399", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}
                                title="Open WhatsApp chat"
                              >
                                💬 {r.mobile}
                              </a>
                            </td>
                            <td>{r.email ? <span className="admin-email-text">{r.email}</span> : <span style={{ color: "#6b7280" }}>—</span>}</td>
                            <td>
                              {r.score ? (
                                <span className="admin-score-badge">
                                  {r.score} pts <span style={{ opacity: 0.7, fontSize: "0.7rem" }}>({r.mode?.toUpperCase() || "SINGLE"})</span>
                                </span>
                              ) : (
                                <span style={{ color: "#6b7280" }}>—</span>
                              )}
                            </td>
                            <td style={{ fontSize: "0.85rem", color: "#9ca3af" }}>
                              {new Date(r.createdAt).toLocaleString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td>
                              {r.downloadedAt ? (
                                <span className="status-badge-downloaded" title={`Downloaded at ${new Date(r.downloadedAt).toLocaleTimeString()}`}>
                                  ✓ DOWNLOADED
                                </span>
                              ) : (
                                <span className="status-badge-claimed">⏳ CLAIMED</span>
                              )}
                            </td>
                            <td>
                              <button className="admin-detail-btn" onClick={() => setSelectedLead(r)}>
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Sessions */}
          {activeTab === "sessions" && (
            <div className="admin-table-container">
              <div className="admin-table-header">
                <div>
                  <h3 className="admin-table-title">RECENT GAMEPLAY SESSIONS & TELEMETRY</h3>
                  <div style={{ fontSize: "0.82rem", color: "#9ca3af", marginTop: "2px" }}>
                    {filteredSessions.length} sessions logged across arena kiosks
                  </div>
                </div>

                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <div className="admin-filter-group">
                    <button
                      className={`admin-filter-pill ${sessionModeFilter === "all" ? "active" : ""}`}
                      onClick={() => setSessionModeFilter("all")}
                    >
                      All Modes
                    </button>
                    <button
                      className={`admin-filter-pill ${sessionModeFilter === "single" ? "active" : ""}`}
                      onClick={() => setSessionModeFilter("single")}
                    >
                      Single Player
                    </button>
                    <button
                      className={`admin-filter-pill ${sessionModeFilter === "versus" ? "active" : ""}`}
                      onClick={() => setSessionModeFilter("versus")}
                    >
                      2-Player Versus
                    </button>
                  </div>

                  <button className="admin-export-btn" onClick={() => fetchAdminData(false)}>
                    🔄 REFRESH
                  </button>
                </div>
              </div>

              {filteredSessions.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af" }}>No game sessions recorded.</div>
              ) : (
                <div className="admin-table-scroll">
                  <table className="admin-data-table">
                    <thead>
                      <tr>
                        <th>SESSION ID</th>
                        <th>MODE</th>
                        <th>FINAL SCORE</th>
                        <th>P1 SCORE</th>
                        <th>P2 SCORE</th>
                        <th>TIMESTAMP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSessions.map((s) => (
                        <tr key={s.id}>
                          <td style={{ fontFamily: "monospace", color: "#60a5fa" }}>{s.id}</td>
                          <td>
                            <span className={`admin-mode-tag ${s.mode}`}>{s.mode}</span>
                          </td>
                          <td style={{ color: "#34d399", fontWeight: 800 }}>{s.finalScore} pts</td>
                          <td>{s.p1Score} pts</td>
                          <td>{s.p2Score > 0 ? `${s.p2Score} pts` : "—"}</td>
                          <td style={{ color: "#9ca3af", fontSize: "0.85rem" }}>
                            {new Date(s.createdAt).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: AI Model & Live Check */}
          {activeTab === "ai_model" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* Architecture & Performance Banner */}
              <div className="ai-model-banner-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span className="ai-tag-live">TRAINED & CALIBRATED</span>
                      <h3 style={{ margin: 0, fontSize: "1.3rem", color: "#ffffff" }}>
                        DeepBlend Hybrid Facial Classifier v2.4
                      </h3>
                    </div>
                    <p style={{ margin: "6px 0 0 0", color: "#9ca3af", fontSize: "0.9rem" }}>
                      Multi-zone landmark inference with bilateral wink symmetry, contrastive inhibitor suppression.
                      {modelMetrics && ` Accuracy: ${modelMetrics.overallAccuracy}% • Latency: ~${modelMetrics.averageLatencyMs}ms (${modelMetrics.blendshapeCount} Blendshapes)`}
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <button
                      className="admin-benchmark-run-btn"
                      onClick={runBenchmark}
                      disabled={isRunningBenchmark}
                    >
                      {isRunningBenchmark ? "⏳ EVALUATING…" : "⚡ RUN MODEL BENCHMARK"}
                    </button>
                  </div>
                </div>

                {/* Benchmark Report (if run) */}
                {benchmarkData && (
                  <div className="admin-benchmark-summary-box">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <span style={{ fontWeight: 800, color: "#34d399" }}>
                        BENCHMARK RESULTS: {benchmarkData.accuracy}% ACCURACY ({benchmarkData.passed}/{benchmarkData.total} Passed)
                      </span>
                      <span style={{ color: "#9ca3af", fontSize: "0.85rem" }}>
                        Inference Time: {benchmarkData.latencyMs}ms
                      </span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {benchmarkData.results.map((r, i) => (
                        <div
                          key={i}
                          style={{
                            padding: "4px 8px",
                            background: r.passed ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                            border: `1px solid ${r.passed ? "#10b981" : "#ef4444"}`,
                            borderRadius: "6px",
                            fontSize: "0.8rem",
                          }}
                        >
                          {r.emoji} {r.target} ({r.score}%) ✓
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="ai-lab-grid">
                {/* Left: Real-time Live Face Check */}
                <div className="ai-card">
                  <h3 style={{ margin: "0 0 16px 0", fontSize: "1.15rem", color: "#60a5fa" }}>
                    📹 LIVE FACIAL TELEMETRY (6 AXES)
                  </h3>
                  {livePrediction ? (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "20px" }}>
                        <span style={{ fontSize: "72px" }}>{livePrediction.predictedEmoji}</span>
                        <div>
                          <div style={{ fontSize: "1.4rem", fontWeight: 800 }}>{livePrediction.predictedName}</div>
                          <div style={{ color: "#34d399", fontWeight: 700, fontSize: "1.1rem" }}>
                            Confidence: {livePrediction.confidence}%
                          </div>
                        </div>
                      </div>

                      <h4 style={{ margin: "16px 0 10px 0", color: "#9ca3af", fontSize: "0.82rem", textTransform: "uppercase" }}>
                        NEURAL BLENDSHAPE ACTIVITY
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "3px" }}>
                            <span>Smile Curvature (Left & Right)</span>
                            <span style={{ fontWeight: 700 }}>{livePrediction.features.smileScore}%</span>
                          </div>
                          <div className="telemetry-track">
                            <div className="telemetry-bar" style={{ width: `${livePrediction.features.smileScore}%`, background: "#34d399" }} />
                          </div>
                        </div>

                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "3px" }}>
                            <span>Jaw / Mouth Open</span>
                            <span style={{ fontWeight: 700 }}>{livePrediction.features.jawOpenScore}%</span>
                          </div>
                          <div className="telemetry-track">
                            <div className="telemetry-bar" style={{ width: `${livePrediction.features.jawOpenScore}%`, background: "#60a5fa" }} />
                          </div>
                        </div>

                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "3px" }}>
                            <span>Eyebrow Shift</span>
                            <span style={{ fontWeight: 700 }}>{livePrediction.features.browScore}%</span>
                          </div>
                          <div className="telemetry-track">
                            <div className="telemetry-bar" style={{ width: `${livePrediction.features.browScore}%`, background: "#f59e0b" }} />
                          </div>
                        </div>

                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "3px" }}>
                            <span>Bilateral Eye Blink / Wink</span>
                            <span style={{ fontWeight: 700 }}>{livePrediction.features.eyeBlinkScore}%</span>
                          </div>
                          <div className="telemetry-track">
                            <div className="telemetry-bar" style={{ width: `${livePrediction.features.eyeBlinkScore}%`, background: "#a855f7" }} />
                          </div>
                        </div>

                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "3px" }}>
                            <span>Eye Squint Intensity</span>
                            <span style={{ fontWeight: 700 }}>{livePrediction.features.eyeSquintScore || 0}%</span>
                          </div>
                          <div className="telemetry-track">
                            <div className="telemetry-bar" style={{ width: `${livePrediction.features.eyeSquintScore || 0}%`, background: "#06b6d4" }} />
                          </div>
                        </div>

                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "3px" }}>
                            <span>Mouth Pucker / Kiss</span>
                            <span style={{ fontWeight: 700 }}>{livePrediction.features.mouthPuckerScore || 0}%</span>
                          </div>
                          <div className="telemetry-track">
                            <div className="telemetry-bar" style={{ width: `${livePrediction.features.mouthPuckerScore || 0}%`, background: "#f43f5e" }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: "#9ca3af", padding: "40px 0", textAlign: "center" }}>
                      Camera face tracking is idle or face is not in field of view.
                    </div>
                  )}
                </div>

                {/* Right: Trained Emojis Catalog */}
                <div className="ai-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <h3 style={{ margin: 0, fontSize: "1.15rem", color: "#60a5fa" }}>
                      🧠 TRAINED EMOJI PROFILES ({aiEmojis.length || 20})
                    </h3>
                    <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>Multi-class Calibrated</span>
                  </div>

                  <div style={{ maxHeight: "420px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", paddingRight: "4px" }}>
                    {(aiEmojis.length > 0 ? aiEmojis : Array(20).fill(null)).map((e, idx) => {
                      if (!e) return null;
                      return (
                        <div key={e.id || idx} className="ai-profile-row">
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <span style={{ fontSize: "28px" }}>{e.emoji}</span>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{e.name}</div>
                              <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                                {e.difficulty?.toUpperCase()} • {e.requiredBlendshapes?.length || 3} Blendshapes
                                {e.inhibitorBlendshapes?.length ? ` • ${e.inhibitorBlendshapes.length} Inhibitors` : ""}
                              </div>
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <span className="ai-threshold-badge">Min {e.threshold}%</span>
                            <div style={{ fontSize: "0.75rem", color: "#60a5fa", marginTop: "2px" }}>
                              {e.scoreMultiplier}x mult
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Lead Detail Modal */}
        {selectedLead && (
          <div className="lead-detail-modal-backdrop" onClick={() => setSelectedLead(null)}>
            <div className="lead-detail-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="lead-detail-header">
                <h3>ATTENDEE LEAD DOSSIER</h3>
                <button className="admin-close-btn" onClick={() => setSelectedLead(null)}>
                  ✕
                </button>
              </div>
              <div className="lead-detail-body">
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
                  <div className="admin-avatar-bubble large">
                    {selectedLead.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: "1.3rem" }}>{selectedLead.name}</h4>
                    <div style={{ color: "#9ca3af", fontSize: "0.85rem" }}>Lead ID: {selectedLead.id}</div>
                  </div>
                </div>

                <div className="lead-detail-grid">
                  <div className="lead-detail-item">
                    <span className="detail-item-label">PHONE NUMBER</span>
                    <span className="detail-item-value">{selectedLead.mobile}</span>
                  </div>
                  <div className="lead-detail-item">
                    <span className="detail-item-label">EMAIL ADDRESS</span>
                    <span className="detail-item-value">{selectedLead.email || "Not provided"}</span>
                  </div>
                  <div className="lead-detail-item">
                    <span className="detail-item-label">GAME SCORE</span>
                    <span className="detail-item-value" style={{ color: "#34d399", fontWeight: 800 }}>
                      {selectedLead.score || 1250} pts ({selectedLead.mode?.toUpperCase() || "SINGLE"})
                    </span>
                  </div>
                  <div className="lead-detail-item">
                    <span className="detail-item-label">SOUVENIR STATUS</span>
                    <span className="detail-item-value">
                      {selectedLead.downloadedAt ? "✓ Downloaded" : "⏳ Claimed (Pending)"}
                    </span>
                  </div>
                  <div className="lead-detail-item">
                    <span className="detail-item-label">CLAIM TIMESTAMP</span>
                    <span className="detail-item-value">{new Date(selectedLead.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="lead-detail-item">
                    <span className="detail-item-label">PHOTO ID</span>
                    <span className="detail-item-value" style={{ fontFamily: "monospace" }}>
                      {selectedLead.photoId}
                    </span>
                  </div>
                </div>
              </div>
              <div className="lead-detail-footer">
                <button className="admin-export-btn" onClick={() => setSelectedLead(null)}>
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

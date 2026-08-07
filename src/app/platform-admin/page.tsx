"use client";

// =============================================================================
// /platform-admin/page.tsx
// -----------------------------------------------------------------------------
// Single-page Super Admin dashboard. Shows a login form if no platform-admin
// session cookie is present, otherwise shows the dashboard with tabs.
//
// All data is fetched from /api/platform-admin/* — NO mock data, NO seeds.
// This is the real production path.
//
// PRD v0.3 §4: the login form includes a 6-digit MFA field as a PLACEHOLDER.
// Any value (or none) is accepted in v1. Real TOTP ships before impersonation.
// =============================================================================

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Users as UsersIcon,
  ScrollText,
  Ticket,
  Activity,
  LogOut,
  AlertCircle,
} from "lucide-react";

type Tab = "dashboard" | "organizations" | "users" | "audit_log" | "student_codes" | "health";

interface AdminSession {
  adminId: string;
  email: string;
  name: string;
  role: string;
}

export default function PlatformAdminPage() {
  const [admin, setAdmin] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("dashboard");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/platform-admin/auth/me", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setAdmin(data.admin);
      } else {
        setAdmin(null);
      }
    } catch {
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!admin) {
    return <LoginForm onLoggedIn={refresh} />;
  }

  return (
    <DashboardShell admin={admin} tab={tab} onTab={setTab} onLogout={refresh} />
  );
}

// ── Login form ──────────────────────────────────────────────────────────────

function LoginForm({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfa, setMfa] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/platform-admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, mfa }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Login failed." }));
        setError(data.error ?? "Login failed.");
        return;
      }
      onLoggedIn();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Platform Super Admin</CardTitle>
          <CardDescription>
            Sign in to the cross-organization admin surface. This is a separate
            identity from tenant users — Managing Partner ≠ Platform Admin.
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mfa" className="flex items-center justify-between">
                <span>MFA code (6 digits)</span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400">
                  placeholder — not real TOTP
                </span>
              </Label>
              <Input
                id="mfa"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={mfa}
                onChange={(e) => setMfa(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="font-mono tracking-[0.4em] text-center"
              />
              <p className="text-[10px] text-muted-foreground">
                Phase 1 ships without MFA. Any value (or none) is accepted. Real
                TOTP is mandatory before impersonation / break-glass ship.
              </p>
            </div>
            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md p-2.5">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </CardContent>
          <div className="px-6 pb-6">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Authenticating…" : "Sign in"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// ── Dashboard shell ──────────────────────────────────────────────────────────

function DashboardShell({
  admin,
  tab,
  onTab,
  onLogout,
}: {
  admin: AdminSession;
  tab: Tab;
  onTab: (t: Tab) => void;
  onLogout: () => void;
}) {
  const nav: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
    { key: "dashboard", label: "Dashboard", icon: <Building2 className="h-4 w-4" /> },
    { key: "organizations", label: "Organizations", icon: <Building2 className="h-4 w-4" /> },
    { key: "users", label: "Users", icon: <UsersIcon className="h-4 w-4" /> },
    { key: "audit_log", label: "Audit Log", icon: <ScrollText className="h-4 w-4" /> },
    { key: "student_codes", label: "Student Codes", icon: <Ticket className="h-4 w-4" /> },
    { key: "health", label: "Platform Health", icon: <Activity className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r bg-muted/30 p-4 flex flex-col">
        <div className="mb-6">
          <div className="font-semibold tracking-tight">Al Mizan</div>
          <div className="text-[11px] text-muted-foreground">Platform Super Admin</div>
        </div>
        <nav className="flex-1 space-y-1">
          {nav.map((item) => (
            <button
              key={item.key}
              onClick={() => onTab(item.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                tab === item.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t pt-3 space-y-2">
          <div className="text-[11px] text-muted-foreground truncate">
            {admin.name}
          </div>
          <div className="text-[10px] text-muted-foreground truncate font-mono">
            {admin.email}
          </div>
          <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">
            no MFA
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={async () => {
              await fetch("/api/platform-admin/auth/logout", { method: "POST" });
              onLogout();
            }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6 min-w-0 overflow-auto">
        {tab === "dashboard" && <DashboardTab />}
        {tab === "organizations" && <OrganizationsTab />}
        {tab === "users" && <UsersTab />}
        {tab === "audit_log" && <AuditLogTab />}
        {tab === "student_codes" && <StudentCodesTab />}
        {tab === "health" && <HealthTab />}
      </main>
    </div>
  );
}

// ── Dashboard tab ────────────────────────────────────────────────────────────

function DashboardTab() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-sm text-muted-foreground">
        Platform-wide overview. Use the sidebar to manage organizations, users,
        audit log, student codes, and platform health.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Organizations" fetcher={async () => {
          const r = await fetch("/api/platform-admin/organizations?limit=1");
          if (!r.ok) return "—";
          const d = await r.json();
          return String(d.pagination?.hasMore ? "50+" : d.data?.length ?? 0);
        }} />
        <KpiCard label="Users" fetcher={async () => {
          const r = await fetch("/api/platform-admin/users?limit=1");
          if (!r.ok) return "—";
          const d = await r.json();
          return String(d.pagination?.hasMore ? "50+" : d.data?.length ?? 0);
        }} />
        <KpiCard label="Audit entries" fetcher={async () => {
          const r = await fetch("/api/platform-admin/audit-log?limit=1");
          if (!r.ok) return "—";
          const d = await r.json();
          return String(d.pagination?.hasMore ? "100+" : d.data?.length ?? 0);
        }} />
      </div>
    </div>
  );
}

function KpiCard({ label, fetcher }: { label: string; fetcher: () => Promise<string> }) {
  const [value, setValue] = useState("…");
  useEffect(() => {
    fetcher().then(setValue);
  }, [fetcher]);
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          {label}
        </div>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

// ── Organizations tab ────────────────────────────────────────────────────────

function OrganizationsTab() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/platform-admin/organizations?limit=100${q ? `&q=${encodeURIComponent(q)}` : ""}`);
    if (res.ok) {
      const d = await res.json();
      setOrgs(d.data);
    }
    setLoading(false);
  }, [q]);

  // Initial load + reload on search change. The async fetch is inlined so no
  // setState runs synchronously in the effect body (react-hooks/set-state-in-effect).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/platform-admin/organizations?limit=100${q ? `&q=${encodeURIComponent(q)}` : ""}`);
      if (cancelled) return;
      if (res.ok) {
        const d = await res.json();
        setOrgs(d.data);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [q]);

  async function toggleSuspend(org: any) {
    if (org.status === "active") {
      const reason = prompt(`Reason for suspending ${org.name}?`);
      if (!reason) return;
      await fetch(`/api/platform-admin/organizations/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "suspended", suspendReason: reason }),
      });
    } else {
      await fetch(`/api/platform-admin/organizations/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
    }
    load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
      <Input placeholder="Search name, slug, or bar ID…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Organization</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Jurisdiction</th>
                <th className="text-center p-3 font-medium">Users</th>
                <th className="text-center p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="text-center p-6 text-muted-foreground">Loading…</td></tr>
              )}
              {!loading && orgs.length === 0 && (
                <tr><td colSpan={5} className="text-center p-6 text-muted-foreground">No organizations.</td></tr>
              )}
              {orgs.map((o) => (
                <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3">
                    <div className="font-medium">{o.name}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{o.slug}</div>
                  </td>
                  <td className="p-3 hidden md:table-cell">{o.jurisdiction}</td>
                  <td className="p-3 text-center font-mono">{o.userCount}</td>
                  <td className="p-3 text-center">
                    <Badge variant={o.status === "active" ? "outline" : "destructive"} className="text-[10px]">
                      {o.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      size="sm"
                      variant={o.status === "active" ? "destructive" : "default"}
                      className="h-7 text-xs"
                      onClick={() => toggleSuspend(o)}
                    >
                      {o.status === "active" ? "Suspend" : "Restore"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Users tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/platform-admin/users?limit=100${q ? `&q=${encodeURIComponent(q)}` : ""}`);
    if (res.ok) {
      const d = await res.json();
      setUsers(d.data);
    }
    setLoading(false);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/platform-admin/users?limit=100${q ? `&q=${encodeURIComponent(q)}` : ""}`);
      if (cancelled) return;
      if (res.ok) {
        const d = await res.json();
        setUsers(d.data);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [q]);

  async function resetPassword(u: any) {
    const pw = prompt(`New password for ${u.name} (min 12 chars, mixed case + digit + special):`);
    if (!pw) return;
    const res = await fetch(`/api/platform-admin/users/${u.id}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: pw }),
    });
    if (res.ok) alert(`Password reset for ${u.email}. Sessions invalidated.`);
    else alert("Reset failed: " + (await res.json()).error);
  }

  async function toggleDelete(u: any) {
    const action = u.deletedAt ? "restore" : "soft_delete";
    await fetch(`/api/platform-admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Users (cross-org)</h1>
      <Input placeholder="Search name, email, or bar ID…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">User</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Organization</th>
                <th className="text-left p-3 font-medium hidden lg:table-cell">Role</th>
                <th className="text-center p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="text-center p-6 text-muted-foreground">Loading…</td></tr>
              )}
              {!loading && users.length === 0 && (
                <tr><td colSpan={5} className="text-center p-6 text-muted-foreground">No users.</td></tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-[11px] text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="p-3 hidden md:table-cell text-xs">{u.organization?.name ?? "—"}</td>
                  <td className="p-3 hidden lg:table-cell">
                    <Badge variant="outline" className="text-[10px]">{u.role}</Badge>
                  </td>
                  <td className="p-3 text-center">
                    {u.deletedAt ? (
                      <Badge variant="secondary" className="text-[10px] text-muted-foreground">deleted</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600">active</Badge>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => resetPassword(u)}>
                        Reset PW
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-destructive"
                        onClick={() => toggleDelete(u)}
                      >
                        {u.deletedAt ? "Restore" : "Delete"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Audit log tab ────────────────────────────────────────────────────────────

function AuditLogTab() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/platform-admin/audit-log?limit=200");
      if (res.ok) {
        const d = await res.json();
        setEntries(d.data);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Audit Log (platform-wide)</h1>
      <p className="text-sm text-muted-foreground">
        Every cross-org action is logged. Platform-only actions show
        <code className="font-mono mx-1">organizationId = null</code>.
      </p>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">When</th>
                <th className="text-left p-3 font-medium">Action</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Organization</th>
                <th className="text-left p-3 font-medium hidden lg:table-cell">Actor</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={4} className="text-center p-6 text-muted-foreground">Loading…</td></tr>
              )}
              {entries.map((al) => (
                <tr key={al.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 text-xs text-muted-foreground font-mono">
                    {new Date(al.createdAt).toLocaleString()}
                  </td>
                  <td className="p-3">
                    <code className="font-mono text-[11px]">{al.action}</code>
                  </td>
                  <td className="p-3 hidden md:table-cell text-xs">
                    {al.organizationName ?? (
                      <span className="italic text-muted-foreground">platform-level</span>
                    )}
                  </td>
                  <td className="p-3 hidden lg:table-cell text-xs">
                    <Badge variant="outline" className="text-[10px] mr-1.5">
                      {al.actorType === "platform_admin" ? "PA" : al.actorType === "system" ? "SYS" : "USR"}
                    </Badge>
                    {al.platformAdminName ?? al.userName ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Student codes tab ────────────────────────────────────────────────────────

function StudentCodesTab() {
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/platform-admin/student-codes?active=0");
    if (res.ok) {
      const d = await res.json();
      setCodes(d.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/platform-admin/student-codes?active=0");
      if (cancelled) return;
      if (res.ok) {
        const d = await res.json();
        setCodes(d.data);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  async function createCode() {
    const code = prompt("New code (e.g. STUDENT-AMJN-XXXX-XXXX):");
    if (!code) return;
    const res = await fetch("/api/platform-admin/student-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, maxMatters: 3, aiQuota: 20, aiQuotaPeriod: "total" }),
    });
    if (res.ok) load();
    else alert("Create failed: " + (await res.json()).error);
  }

  async function toggleCode(c: any) {
    await fetch(`/api/platform-admin/student-codes/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !c.isActive }),
    });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Student / promo codes</h1>
        <Button onClick={createCode} size="sm">New code</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Code</th>
                <th className="text-center p-3 font-medium">Max matters</th>
                <th className="text-center p-3 font-medium">AI quota</th>
                <th className="text-center p-3 font-medium">Used</th>
                <th className="text-center p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="text-center p-6 text-muted-foreground">Loading…</td></tr>
              )}
              {codes.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3"><code className="font-mono text-xs">{c.code}</code></td>
                  <td className="p-3 text-center font-mono">{c.maxMatters}</td>
                  <td className="p-3 text-center font-mono">{c.aiQuota}</td>
                  <td className="p-3 text-center font-mono">{c.usedCount}</td>
                  <td className="p-3 text-center">
                    <Badge variant={c.isActive ? "outline" : "secondary"} className="text-[10px]">
                      {c.isActive ? "active" : "inactive"}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toggleCode(c)}>
                      {c.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Health tab ───────────────────────────────────────────────────────────────

function HealthTab() {
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    fetch("/api/platform-admin/health").then((r) => r.json()).then(setHealth);
  }, []);

  if (!health) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Platform Health</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground uppercase mb-2">Database</div>
            <Badge variant={health.dbConnected ? "outline" : "destructive"} className="text-[10px]">
              {health.dbConnected ? "Connected" : "Unreachable"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground uppercase mb-2">Bootstrap</div>
            <Badge variant={health.bootstrap.firstAdminExists ? "outline" : "destructive"} className="text-[10px]">
              {health.bootstrap.firstAdminExists ? "Admin exists" : "No admin"}
            </Badge>
            <p className="text-[11px] text-muted-foreground mt-2">{health.bootstrap.message}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground uppercase mb-2">Kill-switches</div>
            <div className="space-y-1">
              {health.killSwitches.map((k: any) => (
                <div key={k.envVar} className="text-[11px] flex items-center justify-between">
                  <code className="font-mono">{k.envVar}</code>
                  <Badge variant={k.enabled ? "destructive" : "outline"} className="text-[9px]">
                    {k.enabled ? "ON" : "off"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

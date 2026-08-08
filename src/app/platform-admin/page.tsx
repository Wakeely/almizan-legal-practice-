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
// PRD v0.4 (Phase 2): the login form's MFA field is now REAL when the admin
// has enrolled in TOTP. The dashboard adds Billing, AI Usage, and MFA
// enrollment tabs, plus org-detail drill-down and impersonation/break-glass
// actions (both gated behind mfaEnabled = true).
// =============================================================================

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  DollarSign,
  Cpu,
  ShieldCheck,
  UserCog,
  Eye,
  ArrowLeft,
} from "lucide-react";

type Tab =
  | "dashboard"
  | "organizations"
  | "users"
  | "audit_log"
  | "student_codes"
  | "health"
  | "billing"
  | "ai_usage"
  | "mfa";

interface AdminSession {
  adminId: string;
  email: string;
  name: string;
  role: string;
  mfaEnabled: boolean;
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
    { key: "billing", label: "Billing", icon: <DollarSign className="h-4 w-4" /> },
    { key: "ai_usage", label: "AI Usage", icon: <Cpu className="h-4 w-4" /> },
    { key: "audit_log", label: "Audit Log", icon: <ScrollText className="h-4 w-4" /> },
    { key: "student_codes", label: "Student Codes", icon: <Ticket className="h-4 w-4" /> },
    { key: "mfa", label: "MFA / Security", icon: <ShieldCheck className="h-4 w-4" /> },
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
          {admin.mfaEnabled ? (
            <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600">
              <ShieldCheck className="h-3 w-3 mr-1" />MFA on
            </Badge>
          ) : (
            <button onClick={() => onTab("mfa")} className="block">
              <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600 cursor-pointer">
                no MFA — enroll
              </Badge>
            </button>
          )}
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
        {tab === "users" && <UsersTab mfaEnabled={admin.mfaEnabled} />}
        {tab === "billing" && <BillingTab />}
        {tab === "ai_usage" && <AiUsageTab />}
        {tab === "audit_log" && <AuditLogTab />}
        {tab === "student_codes" && <StudentCodesTab />}
        {tab === "mfa" && <MfaTab admin={admin} onChanged={onLogout} />}
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
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

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
                <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedOrgId(o.id)}>
                  <td className="p-3">
                    <div className="font-medium text-primary hover:underline">{o.name}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{o.slug}</div>
                  </td>
                  <td className="p-3 hidden md:table-cell">{o.jurisdiction}</td>
                  <td className="p-3 text-center font-mono">{o.userCount}</td>
                  <td className="p-3 text-center">
                    <Badge variant={o.status === "active" ? "outline" : "destructive"} className="text-[10px]">
                      {o.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
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
      {selectedOrgId && (
        <OrgDetailPanel orgId={selectedOrgId} onClose={() => setSelectedOrgId(null)} onChanged={load} />
      )}
    </div>
  );
}

// ── Org detail panel (Phase 2 §2.3) ─────────────────────────────────────────

function OrgDetailPanel({ orgId, onClose, onChanged }: { orgId: string; onClose: () => void; onChanged: () => void }) {
  const [org, setOrg] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [orgRes, usersRes] = await Promise.all([
        fetch(`/api/platform-admin/organizations/${orgId}`),
        fetch(`/api/platform-admin/users?org=${orgId}&limit=100`),
      ]);
      if (cancelled) return;
      if (orgRes.ok) setOrg((await orgRes.json()).data);
      if (usersRes.ok) setUsers((await usersRes.json()).data);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orgId]);

  async function toggleAddon() {
    if (!org) return;
    await fetch(`/api/platform-admin/organizations/${orgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ investigationAgentEnabled: !org.investigationAgentEnabled }),
    });
    // Reload the org detail
    const res = await fetch(`/api/platform-admin/organizations/${orgId}`);
    if (res.ok) setOrg((await res.json()).data);
    onChanged();
  }

  if (loading) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading detail…</CardContent></Card>;
  if (!org) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Organization not found.</CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{org.name}</CardTitle>
            <CardDescription className="font-mono">{org.slug} · {org.id}</CardDescription>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <ArrowLeft className="h-4 w-4 mr-1" />Back to list
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Profile */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div><div className="text-[11px] text-muted-foreground">Jurisdiction</div><div>{org.jurisdiction}</div></div>
          <div><div className="text-[11px] text-muted-foreground">Bar ID</div><div className="font-mono text-xs">{org.barAssociationId ?? "—"}</div></div>
          <div><div className="text-[11px] text-muted-foreground">Status</div><div><Badge variant={org.status === "active" ? "outline" : "destructive"} className="text-[10px]">{org.status}</Badge></div></div>
          <div><div className="text-[11px] text-muted-foreground">Created</div><div className="text-xs">{new Date(org.createdAt).toLocaleDateString()}</div></div>
        </div>

        {/* Counts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Users", value: org.counts.users },
            { label: "Matters", value: org.counts.matters },
            { label: "Documents", value: org.counts.documents },
            { label: "Audit entries", value: org.counts.auditLogs },
          ].map((c) => (
            <div key={c.label} className="border rounded-md p-3 bg-muted/30">
              <div className="text-[11px] text-muted-foreground">{c.label}</div>
              <div className="text-xl font-semibold">{c.value}</div>
            </div>
          ))}
        </div>

        {/* Add-on toggle */}
        <div className="border rounded-md p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Case Investigation Agent</div>
              <div className="text-[11px] text-muted-foreground">Multi-step agent pipeline (intake → research → court routing → drafting → citation verify → fact check → assembly).</div>
            </div>
            <Switch checked={org.investigationAgentEnabled} onCheckedChange={toggleAddon} />
          </div>
        </div>

        {/* BYOK AI keys (status only — never the key value) */}
        <div className="border rounded-md p-4 space-y-2">
          <div className="text-sm font-medium">BYOK AI Keys</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div><div className="text-muted-foreground">Provider</div><div className="capitalize">{org.aiKeyProvider ?? "platform key"}</div></div>
            <div><div className="text-muted-foreground">Configured</div><Badge variant="outline" className="text-[10px]">{org.aiKeyConfigured ? "yes" : "no"}</Badge></div>
            <div><div className="text-muted-foreground">Last verified</div><div>{org.aiKeyLastVerifiedAt ? new Date(org.aiKeyLastVerifiedAt).toLocaleString() : "—"}</div></div>
          </div>
          <p className="text-[10px] text-muted-foreground">Keys are AES-256-GCM encrypted at rest. The decrypted value is never surfaced — even to a Super Admin.</p>
        </div>

        {/* Users in this org */}
        <div className="border rounded-md p-4 space-y-2">
          <div className="text-sm font-medium">Users ({users.length})</div>
          <div className="space-y-1 max-h-48 overflow-auto">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                <div>
                  <span className="font-medium">{u.name}</span>
                  <span className="text-muted-foreground ml-2">{u.email}</span>
                </div>
                <Badge variant="outline" className="text-[10px]">{u.role}</Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Users tab ────────────────────────────────────────────────────────────────

function UsersTab({ mfaEnabled }: { mfaEnabled: boolean }) {
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

  async function impersonate(u: any) {
    const reason = prompt(`Reason for impersonating ${u.name}? (optional but recommended for the audit log)`);
    if (reason === null) return; // user clicked cancel
    const res = await fetch("/api/platform-admin/impersonation/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: u.id, reason: reason || undefined }),
    });
    if (res.ok) {
      const d = await res.json();
      alert(d.message + "\n\nYou will be redirected to the tenant workspace. A banner will show the impersonation is active.");
      window.open(d.redirectTo, "_blank");
    } else {
      const d = await res.json().catch(() => ({ error: "Impersonation failed." }));
      alert(d.error);
    }
  }

  async function breakGlass(u: any) {
    const reason = prompt(`Break-glass access for ${u.name}'s data.\n\nProvide a detailed reason (min 10 chars) — this is permanently recorded in the audit log:`);
    if (!reason || reason.length < 10) {
      if (reason !== null) alert("Reason must be at least 10 characters.");
      return;
    }
    const res = await fetch("/api/platform-admin/break-glass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: u.organization?.id,
        reason,
        recordType: "other",
        recordId: u.id,
      }),
    });
    if (res.ok) {
      const d = await res.json();
      alert(d.message);
    } else {
      const d = await res.json().catch(() => ({ error: "Break-glass failed." }));
      alert(d.error);
    }
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
                <th className="text-left p-3 font-medium hidden lg:table-cell">Account</th>
                <th className="text-left p-3 font-medium hidden lg:table-cell">Role</th>
                <th className="text-center p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="text-center p-6 text-muted-foreground">Loading…</td></tr>
              )}
              {!loading && users.length === 0 && (
                <tr><td colSpan={6} className="text-center p-6 text-muted-foreground">No users.</td></tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-[11px] text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="p-3 hidden md:table-cell text-xs">{u.organization?.name ?? "—"}</td>
                  <td className="p-3 hidden lg:table-cell text-xs">{u.accountType ?? "—"}</td>
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
                        className="h-7 text-xs"
                        disabled={!mfaEnabled || !!u.deletedAt}
                        title={!mfaEnabled ? "MFA required — enroll in MFA / Security tab first" : "Log in as this user (30 min, audited)"}
                        onClick={() => impersonate(u)}
                      >
                        <UserCog className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        disabled={!mfaEnabled}
                        title={!mfaEnabled ? "MFA required — enroll first" : "Break-glass access (reason required, audited)"}
                        onClick={() => breakGlass(u)}
                      >
                        <Eye className="h-3 w-3" />
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

// ── Billing tab (Phase 2 §2.2) ───────────────────────────────────────────────

function BillingTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/platform-admin/users?limit=200&deleted=0");
      if (cancelled) return;
      if (res.ok) {
        const d = await res.json();
        setUsers(d.data);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = users.filter((u) => {
    if (!filter) return true;
    if (filter === "trial_expiring") {
      return u.planStatus === "Trial" && u.trialDaysLeft <= 7;
    }
    return u.planStatus === filter || u.subscriptionTier === filter;
  });

  async function override(u: any) {
    const field = prompt(
      `Override which field for ${u.name}?\n\n1. subscriptionTier (current: ${u.subscriptionTier})\n2. planStatus (current: ${u.planStatus})\n3. trialDaysLeft (current: ${u.trialDaysLeft})\n4. seats (current: ${u.seats})\n5. maxSeats (current: ${u.maxSeats})\n6. billingCycle (current: ${u.billingCycle})\n7. renewalDate (current: ${u.renewalDate ?? "none"})\n\nEnter 1-7:`
    );
    if (!field) return;
    const fieldMap: Record<string, string> = {
      "1": "subscriptionTier", "2": "planStatus", "3": "trialDaysLeft",
      "4": "seats", "5": "maxSeats", "6": "billingCycle", "7": "renewalDate",
    };
    const fieldName = fieldMap[field];
    if (!fieldName) return;
    const newValue = prompt(`New value for ${fieldName}:`);
    if (newValue === null) return;
    const reason = prompt(`Reason for this override (min 5 chars, recorded in audit log):`);
    if (!reason || reason.length < 5) {
      alert("Reason is required (min 5 characters).");
      return;
    }
    const body: any = { reason };
    if (fieldName === "trialDaysLeft" || fieldName === "seats" || fieldName === "maxSeats") {
      body[fieldName] = parseInt(newValue, 10);
    } else if (fieldName === "renewalDate") {
      body[fieldName] = newValue ? new Date(newValue).toISOString() : null;
    } else {
      body[fieldName] = newValue;
    }
    const res = await fetch(`/api/platform-admin/users/${u.id}/subscription`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      alert("Override applied. Audit entry recorded.");
      // Reload
      const r = await fetch("/api/platform-admin/users?limit=200&deleted=0");
      if (r.ok) setUsers((await r.json()).data);
    } else {
      const d = await res.json().catch(() => ({ error: "Override failed." }));
      alert(d.error);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing & Subscriptions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manual overrides only — payments are simulated platform-wide. This is account-state, not a ledger: it does not touch real money.
          Every override requires a reason and writes a <code className="font-mono">platform_admin.subscription_override</code> audit entry.
        </p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {["", "Trial", "Active", "Past Due", "trial_expiring"].map((f) => (
          <Button
            key={f || "all"}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
          >
            {f === "" ? "All" : f === "trial_expiring" ? "Trial ≤7d" : f}
          </Button>
        ))}
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">User</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Org</th>
                <th className="text-left p-3 font-medium">Tier</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-center p-3 font-medium hidden lg:table-cell">Seats</th>
                <th className="text-center p-3 font-medium hidden lg:table-cell">Renewal</th>
                <th className="text-right p-3 font-medium">Override</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="text-center p-6 text-muted-foreground">Loading…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center p-6 text-muted-foreground">No users match this filter.</td></tr>
              )}
              {filtered.map((u) => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-[11px] text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="p-3 hidden md:table-cell text-xs">{u.organization?.name ?? "—"}</td>
                  <td className="p-3 text-xs">{u.subscriptionTier}</td>
                  <td className="p-3">
                    <Badge variant="outline" className="text-[10px]">{u.planStatus}</Badge>
                    {u.planStatus === "Trial" && (
                      <span className="text-[10px] text-muted-foreground ml-1">({u.trialDaysLeft}d)</span>
                    )}
                  </td>
                  <td className="p-3 text-center font-mono text-xs hidden lg:table-cell">{u.seats}/{u.maxSeats}</td>
                  <td className="p-3 text-center text-xs hidden lg:table-cell">{u.renewalDate ? new Date(u.renewalDate).toLocaleDateString() : "—"}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => override(u)}>
                      Override
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

// ── AI Usage tab (Phase 2 §2.4) ──────────────────────────────────────────────

function AiUsageTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/platform-admin/ai-usage?days=30");
      if (cancelled) return;
      if (res.ok) setData(await res.json());
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Failed to load AI usage data.</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Usage & Cost</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Per-call tracking written at the AI dispatch layer. Period: last {data.period.days} days.
        </p>
      </div>

      {/* Spike alerts */}
      {data.spikeAlerts?.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <div className="text-sm font-medium text-amber-700 dark:text-amber-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {data.spikeAlerts.length} org(s) with spend spike today (vs 7-day average)
            </div>
            <div className="mt-2 space-y-1">
              {data.spikeAlerts.map((s: any) => (
                <div key={s.organizationId} className="text-xs flex items-center justify-between">
                  <span>{s.organizationName}</span>
                  <span className="font-mono">
                    ${s.todaySpendUsd.toFixed(2)} today vs ${s.trailing7DayAvgUsd.toFixed(2)}/day avg ({s.ratio.toFixed(1)}×)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase mb-2">Total calls</div>
          <div className="text-2xl font-semibold">{data.totals.calls.toLocaleString()}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase mb-2">Est. cost</div>
          <div className="text-2xl font-semibold">${data.totals.costUsd.toFixed(2)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase mb-2">BYOK calls</div>
          <div className="text-2xl font-semibold">{data.totals.byokCalls.toLocaleString()}</div>
          <div className="text-[10px] text-muted-foreground">no inference cost</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase mb-2">Platform calls</div>
          <div className="text-2xl font-semibold">{data.totals.platformCalls.toLocaleString()}</div>
        </CardContent></Card>
      </div>

      {/* Per-provider */}
      <Card>
        <CardHeader><CardTitle className="text-sm">By provider</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Provider</th>
                <th className="text-center p-3 font-medium">Calls</th>
                <th className="text-center p-3 font-medium">Tokens in</th>
                <th className="text-center p-3 font-medium">Tokens out</th>
                <th className="text-right p-3 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {data.perProvider.map((p: any) => (
                <tr key={p.provider} className="border-b last:border-0">
                  <td className="p-3 capitalize">{p.provider}</td>
                  <td className="p-3 text-center font-mono">{p.calls.toLocaleString()}</td>
                  <td className="p-3 text-center font-mono">{p.tokensIn.toLocaleString()}</td>
                  <td className="p-3 text-center font-mono">{p.tokensOut.toLocaleString()}</td>
                  <td className="p-3 text-right font-mono">${p.costUsd.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Top spenders */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Top spenders (orgs)</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Organization</th>
                <th className="text-center p-3 font-medium">Calls</th>
                <th className="text-center p-3 font-medium">BYOK</th>
                <th className="text-center p-3 font-medium">Platform</th>
                <th className="text-right p-3 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {data.topSpenders.map((o: any) => (
                <tr key={o.organizationId} className="border-b last:border-0">
                  <td className="p-3">{o.organizationName}</td>
                  <td className="p-3 text-center font-mono">{o.calls.toLocaleString()}</td>
                  <td className="p-3 text-center font-mono text-xs">{o.byokCalls}</td>
                  <td className="p-3 text-center font-mono text-xs">{o.platformCalls}</td>
                  <td className="p-3 text-right font-mono">${o.costUsd.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Promo quota usage */}
      {data.promoQuotaUsage?.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Promo / student quota usage</CardTitle>
          <CardDescription>Existing tracking — newly surfaced.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">User</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Code</th>
                  <th className="text-center p-3 font-medium">Used / Quota</th>
                  <th className="text-center p-3 font-medium">Period</th>
                  <th className="text-center p-3 font-medium">Expires</th>
                </tr>
              </thead>
              <tbody>
                {data.promoQuotaUsage.map((u: any) => (
                  <tr key={u.userId} className="border-b last:border-0">
                    <td className="p-3">
                      <div className="font-medium">{u.name}</div>
                      <div className="text-[11px] text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="p-3 hidden md:table-cell font-mono text-xs">{u.promoCode}</td>
                    <td className="p-3 text-center font-mono">{u.used} / {u.quota}</td>
                    <td className="p-3 text-center text-xs">{u.period}</td>
                    <td className="p-3 text-center text-xs">{u.expiresAt ? new Date(u.expiresAt).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── MFA / Security tab (Phase 2 §2.1) ────────────────────────────────────────

function MfaTab({ admin, onChanged }: { admin: AdminSession; onChanged: () => void }) {
  const [step, setStep] = useState<"idle" | "enrolling" | "enrolled">("idle");
  const [secret, setSecret] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function beginEnroll() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/platform-admin/auth/mfa/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "begin" }),
      });
      if (res.ok) {
        const d = await res.json();
        setSecret(d.secret);
        setOtpauthUrl(d.otpauthUrl);
        setStep("enrolling");
      } else {
        const d = await res.json().catch(() => ({ error: "Failed to begin enrollment." }));
        setError(d.error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnroll() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/platform-admin/auth/mfa/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "confirm", secret, code: confirmCode }),
      });
      if (res.ok) {
        const d = await res.json();
        setRecoveryCodes(d.recoveryCodes);
        setStep("enrolled");
      } else {
        const d = await res.json().catch(() => ({ error: "Invalid code." }));
        setError(d.error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    const code = prompt("Enter your current TOTP or recovery code to disable MFA:");
    if (!code) return;
    setBusy(true);
    try {
      const res = await fetch("/api/platform-admin/auth/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        onChanged(); // re-fetch session
      } else {
        const d = await res.json().catch(() => ({ error: "Failed." }));
        alert(d.error);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">MFA / Security</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real TOTP (RFC 6238). MFA is mandatory before impersonation or break-glass access can be used.
        </p>
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">MFA status</div>
              <div className="text-[11px] text-muted-foreground">
                {admin.mfaEnabled
                  ? "Enabled — TOTP + recovery codes active."
                  : "Not enabled. Impersonation and break-glass are blocked until you enroll."}
              </div>
            </div>
            <Badge variant={admin.mfaEnabled ? "outline" : "destructive"} className="text-[10px]">
              {admin.mfaEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>

          {admin.mfaEnabled ? (
            <Button variant="destructive" size="sm" onClick={disable} disabled={busy}>
              Disable MFA
            </Button>
          ) : step === "idle" ? (
            <Button onClick={beginEnroll} disabled={busy}>
              Begin TOTP enrollment
            </Button>
          ) : step === "enrolling" ? (
            <div className="space-y-3">
              <div className="text-sm">
                <div className="font-medium mb-1">1. Scan this secret in your authenticator app</div>
                <div className="text-[11px] text-muted-foreground">Google Authenticator, 1Password, Authy, etc.</div>
              </div>
              <div className="bg-muted p-3 rounded-md break-all font-mono text-xs">{secret}</div>
              <div className="text-[11px] text-muted-foreground break-all">
                Or enter manually. URL: <code className="font-mono">{otpauthUrl}</code>
              </div>
              <div className="text-sm pt-2">
                <div className="font-medium mb-1">2. Enter the 6-digit code from your app</div>
                <Input
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="font-mono tracking-[0.4em] text-center max-w-xs"
                />
              </div>
              {error && <div className="text-sm text-destructive">{error}</div>}
              <div className="flex gap-2">
                <Button onClick={confirmEnroll} disabled={busy || confirmCode.length !== 6}>
                  Confirm & enable
                </Button>
                <Button variant="outline" onClick={() => setStep("idle")} disabled={busy}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : step === "enrolled" && recoveryCodes ? (
            <div className="space-y-3">
              <div className="text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-md p-3 text-sm">
                <strong>MFA enabled.</strong> Save these recovery codes in a secure location. Each can be used once in place of a TOTP code. They will not be shown again.
              </div>
              <div className="bg-muted p-3 rounded-md grid grid-cols-2 gap-1 font-mono text-xs">
                {recoveryCodes.map((c, i) => (
                  <div key={i}>{c}</div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={onChanged}>
                Done — reload session
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

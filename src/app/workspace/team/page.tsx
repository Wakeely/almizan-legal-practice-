"use client";

// =============================================================================
// /workspace/team — Managing Partner team management (PRD v0.6 §5.3)
// -----------------------------------------------------------------------------
// Lists current org members + pending invitations. Managing Partners can
// invite teammates (Senior Associate / In-House Counsel / Legal Executive)
// and revoke pending invites. Other roles can view the team but not invite.
// =============================================================================

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/providers/auth-provider";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users as UsersIcon,
  UserPlus,
  Trash2,
  Mail,
  Clock,
  ShieldCheck,
} from "lucide-react";

interface Member {
  id: string;
  email: string;
  name: string;
  role: string;
  accountType: string;
  primaryMatterId: string | null;
  deletedAt: string | null;
  createdAt: string;
  emailVerified: string | null;
  isCurrentUser: boolean;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  invitedByUserId: string;
}

export default function TeamPage() {
  const { user } = useAuth();
  const isManagingPartner = user?.role === "Managing Partner";

  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"Senior Associate" | "In-House Counsel" | "Legal Executive">("Senior Associate");
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [membersRes, invitesRes] = await Promise.all([
        fetch("/api/team/members"),
        fetch("/api/team/invitations"),
      ]);
      if (membersRes.ok) {
        const d = await membersRes.json();
        setMembers(d.data);
      }
      if (invitesRes.ok) {
        const d = await invitesRes.json();
        setInvitations(d.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [membersRes, invitesRes] = await Promise.all([
        fetch("/api/team/members"),
        fetch("/api/team/invitations"),
      ]);
      if (cancelled) return;
      if (membersRes.ok) setMembers((await membersRes.json()).data);
      if (invitesRes.ok) setInvitations((await invitesRes.json()).data);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setInviting(true);
    try {
      const res = await fetch("/api/team/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const d = await res.json();
      if (res.ok) {
        setMessage(d.emailSent
          ? `Invitation sent to ${inviteEmail}.`
          : `Invitation created for ${inviteEmail} but email failed to send. Share the link manually.`);
        setInviteEmail("");
        await load();
      } else {
        setError(d.error ?? "Failed to send invitation.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setInviting(false);
    }
  }

  async function revokeInvite(id: string) {
    if (!confirm("Revoke this pending invitation?")) return;
    const res = await fetch(`/api/team/invitations/${id}`, { method: "DELETE" });
    if (res.ok) {
      await load();
    } else {
      const d = await res.json().catch(() => ({ error: "Failed." }));
      alert(d.error);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading team…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <UsersIcon className="h-6 w-6" />
          Team
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your firm's members and pending invitations.
        </p>
      </div>

      {/* Invite form — Managing Partner only */}
      {isManagingPartner ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Invite a teammate
            </CardTitle>
            <CardDescription>
              Send an invitation to join your firm. Available roles: Senior Associate, In-House Counsel, Legal Executive.
              Client invitations are sent from a specific matter's page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={sendInvite} className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 space-y-1.5 w-full">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  required
                />
              </div>
              <div className="space-y-1.5 w-full sm:w-56">
                <Label htmlFor="role">Role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as typeof inviteRole)}>
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Senior Associate">Senior Associate</SelectItem>
                    <SelectItem value="In-House Counsel">In-House Counsel</SelectItem>
                    <SelectItem value="Legal Executive">Legal Executive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={inviting}>
                {inviting ? "Sending…" : "Send invitation"}
              </Button>
            </form>
            {message && <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-3">{message}</p>}
            {error && <p className="text-sm text-destructive mt-3">{error}</p>}
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-muted/30">
          <CardContent className="p-4 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 inline mr-2" />
            Only the Managing Partner can invite new teammates. Contact your firm's Managing Partner if you need someone added.
          </CardContent>
        </Card>
      )}

      {/* Members list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Email</th>
                <th className="text-left p-3 font-medium">Role</th>
                <th className="text-center p-3 font-medium hidden lg:table-cell">Joined</th>
                <th className="text-center p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3">
                    <div className="font-medium">
                      {m.name}
                      {m.isCurrentUser && <span className="text-[10px] text-muted-foreground ml-2">(you)</span>}
                    </div>
                    <div className="text-[11px] text-muted-foreground md:hidden">{m.email}</div>
                  </td>
                  <td className="p-3 hidden md:table-cell text-xs">{m.email}</td>
                  <td className="p-3">
                    <Badge variant="outline" className="text-[10px]">{m.role}</Badge>
                  </td>
                  <td className="p-3 text-center text-xs hidden lg:table-cell">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-center">
                    {m.deletedAt ? (
                      <Badge variant="secondary" className="text-[10px] text-muted-foreground">removed</Badge>
                    ) : m.emailVerified ? (
                      <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600">active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">unverified</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Pending invitations */}
      {isManagingPartner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Pending invitations ({invitations.filter((i) => i.status === "pending").length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Email</th>
                  <th className="text-left p-3 font-medium">Role</th>
                  <th className="text-center p-3 font-medium hidden md:table-cell">Sent</th>
                  <th className="text-center p-3 font-medium">Expires</th>
                  <th className="text-center p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {invitations.length === 0 && (
                  <tr><td colSpan={6} className="text-center p-6 text-muted-foreground">No invitations.</td></tr>
                )}
                {invitations.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3">{inv.email}</td>
                    <td className="p-3"><Badge variant="outline" className="text-[10px]">{inv.role}</Badge></td>
                    <td className="p-3 text-center text-xs hidden md:table-cell">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-center text-xs">
                      <Clock className="inline h-3 w-3 mr-1 text-muted-foreground" />
                      {new Date(inv.expiresAt).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-center">
                      <Badge
                        variant={inv.status === "pending" ? "outline" : inv.status === "accepted" ? "secondary" : "destructive"}
                        className="text-[10px]"
                      >
                        {inv.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      {inv.status === "pending" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-destructive"
                          onClick={() => revokeInvite(inv.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </td>
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

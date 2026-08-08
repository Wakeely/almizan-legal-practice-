'use client';

// =============================================================================
// MatterAssignments — manage which attorneys are assigned to a matter
// -----------------------------------------------------------------------------
// PRD v0.7 Fix 2e: a small UI addition on the matter detail page. Lets a
// Managing Partner (or any already-assigned attorney) add/remove other org
// members as assignees. The Managing Partner always has owner-override.
// =============================================================================

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users as UsersIcon, UserPlus, Trash2 } from 'lucide-react';

interface Assignment {
  id: string;
  userId: string;
  role: string;
  user: { id: string; name: string; email: string; role: string };
}

interface Member {
  id: string;
  email: string;
  name: string;
  role: string;
}

export default function MatterAssignments({ matterId }: { matterId: string }) {
  const { user } = useAuth();
  const isManagingPartner = user?.role === 'Managing Partner';

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [aRes, mRes] = await Promise.all([
        fetch(`/api/matters/${matterId}/assignments`),
        fetch('/api/team/members'),
      ]);
      if (cancelled) return;
      if (aRes.ok) setAssignments((await aRes.json()).data);
      if (mRes.ok) setMembers((await mRes.json()).data);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [matterId]);

  // Filter out members who are already assigned + clients
  const assignableMembers = members.filter(
    (m) =>
      m.role !== 'Client Representative' &&
      !assignments.some((a) => a.userId === m.id),
  );

  async function addAssignment() {
    if (!selectedUserId) return;
    setBusy(true);
    const res = await fetch(`/api/matters/${matterId}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: selectedUserId, role: 'attorney' }),
    });
    if (res.ok) {
      setSelectedUserId('');
      const res2 = await fetch(`/api/matters/${matterId}/assignments`);
      if (res2.ok) setAssignments((await res2.json()).data);
    } else {
      const d = await res.json().catch(() => ({ error: 'Failed.' }));
      alert(d.error);
    }
    setBusy(false);
  }

  async function removeAssignment(userId: string) {
    if (!confirm('Remove this attorney from the matter?')) return;
    const res = await fetch(`/api/matters/${matterId}/assignments/${userId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      const res2 = await fetch(`/api/matters/${matterId}/assignments`);
      if (res2.ok) setAssignments((await res2.json()).data);
    } else {
      const d = await res.json().catch(() => ({ error: 'Failed.' }));
      alert(d.error);
    }
  }

  if (loading) return null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <UsersIcon className="h-4 w-4" />
          Assigned attorneys ({assignments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          {assignments.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              No attorneys assigned. The Managing Partner can still invite clients via owner-override.
            </p>
          )}
          {assignments.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{a.user.name}</span>
                <span className="text-[11px] text-muted-foreground">{a.user.email}</span>
                <Badge variant="outline" className="text-[10px]">{a.user.role}</Badge>
                {a.role === 'lead' && (
                  <Badge variant="secondary" className="text-[10px]">lead</Badge>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-destructive"
                onClick={() => removeAssignment(a.userId)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        {assignableMembers.length > 0 && (
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <label className="text-[11px] text-muted-foreground">Add attorney</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select a team member…" />
                </SelectTrigger>
                <SelectContent>
                  {assignableMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} — {m.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={addAssignment} disabled={busy || !selectedUserId}>
              <UserPlus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </div>
        )}
        {!isManagingPartner && assignments.length === 0 && (
          <p className="text-[11px] text-muted-foreground">
            Only the Managing Partner can add the first assignee. Once assigned, that attorney can also manage assignments.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

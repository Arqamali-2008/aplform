import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  Download,
  Check,
  X,
  Trash2,
  Loader2,
  RefreshCw,
  FileJson,
  Filter,
  Lock,
  LogOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import aplLogo from "@/assets/apl-logo.png.asset.json";
import {
  listRegistrations,
  setRegistrationStatus,
  deleteRegistration,
  type RegistrationRecord,
} from "@/lib/apl-registration.functions";

const ADMIN_PASSWORD = "Admin.APL";
const AUTH_KEY = "apl-admin-auth";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Panel — APL Registrations" },
      { name: "description", content: "Manage APL / ALPL team registrations, approve, and export JSON." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(AUTH_KEY) === "1") setAuthed(true);
    } catch {
      /* ignore */
    }
    setChecked(true);
  }, []);

  if (!checked) return null;
  if (!authed) return <PasswordGate onSuccess={() => setAuthed(true)} />;
  return <AdminInner onLogout={() => {
    try { sessionStorage.removeItem(AUTH_KEY); } catch { /* ignore */ }
    setAuthed(false);
  }} />;
}

function PasswordGate({ onSuccess }: { onSuccess: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw === ADMIN_PASSWORD) {
      try { sessionStorage.setItem(AUTH_KEY, "1"); } catch { /* ignore */ }
      onSuccess();
    } else {
      setErr(true);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-card space-y-4"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="rounded-full bg-primary/10 p-3">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <h1 className="font-display text-xl font-bold">Admin Access</h1>
          <p className="text-sm text-muted-foreground">Enter the admin password to continue.</p>
        </div>
        <div className="space-y-1">
          <Input
            type="password"
            autoFocus
            placeholder="Password"
            value={pw}
            onChange={(e) => { setPw(e.target.value); setErr(false); }}
          />
          {err && <p className="text-xs text-destructive">Incorrect password</p>}
        </div>
        <Button type="submit" className="w-full">Unlock</Button>
        <div className="text-center">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Back to home</Link>
        </div>
      </form>
    </div>
  );
}

function AdminInner({ onLogout }: { onLogout: () => void }) {
  const qc = useQueryClient();
  const list = useServerFn(listRegistrations);
  const setStatus = useServerFn(setRegistrationStatus);
  const del = useServerFn(deleteRegistration);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["registrations"],
    queryFn: () => list(),
  });

  const [search, setSearch] = useState("");
  const [tournament, setTournament] = useState<string>("all");
  const [status, setStatusFilter] = useState<string>("all");
  const [detail, setDetail] = useState<RegistrationRecord | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const filtered = useMemo(() => {
    const records = data?.records || [];
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (tournament !== "all" && r.tournament !== tournament) return false;
      if (status !== "all" && r.status !== status) return false;
      if (!q) return true;
      return (
        r.registrationId.toLowerCase().includes(q) ||
        r.teamName.toLowerCase().includes(q) ||
        r.batch.toLowerCase().includes(q) ||
        r.captain.name.toLowerCase().includes(q)
      );
    });
  }, [data, search, tournament, status]);

  // Prune selection when filter changes
  useEffect(() => {
    const visibleIds = new Set(filtered.map((r) => r.registrationId));
    setSelected((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => visibleIds.has(id) && next.add(id));
      return next;
    });
  }, [filtered]);

  const allVisibleChecked = filtered.length > 0 && filtered.every((r) => selected.has(r.registrationId));
  const someChecked = selected.size > 0;

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    if (checked) setSelected(new Set(filtered.map((r) => r.registrationId)));
    else setSelected(new Set());
  }

  const statusMut = useMutation({
    mutationFn: (v: { registrationId: string; status: "Pending" | "Approved" | "Rejected" }) =>
      setStatus({ data: v }),
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["registrations"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (registrationId: string) => del({ data: { registrationId } }),
    onSuccess: () => {
      toast.success("Registration deleted");
      qc.invalidateQueries({ queryKey: ["registrations"] });
      setDetail(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  async function bulkSetStatus(newStatus: "Approved" | "Rejected") {
    const records = (data?.records || []).filter((r) => selected.has(r.registrationId));
    const targets = records.filter((r) => r.status !== newStatus);
    if (targets.length === 0) {
      toast.info(`No registrations to ${newStatus.toLowerCase()}`);
      return;
    }
    if (!confirm(`${newStatus === "Approved" ? "Approve" : "Reject"} ${targets.length} registration(s)?`)) return;

    setBulkBusy(true);
    let ok = 0, fail = 0;
    // Sequential to avoid Sheets write races
    for (const r of targets) {
      try {
        await setStatus({ data: { registrationId: r.registrationId, status: newStatus } });
        ok++;
      } catch {
        fail++;
      }
    }
    setBulkBusy(false);
    qc.invalidateQueries({ queryKey: ["registrations"] });
    setSelected(new Set());
    if (fail === 0) toast.success(`${newStatus}: ${ok} registration(s)`);
    else toast.warning(`${newStatus}: ${ok} ok, ${fail} failed`);
  }

  function exportOne(r: RegistrationRecord) {
    downloadJson(`${r.registrationId}.json`, recordToExport(r));
    toast.success(`Downloaded ${r.registrationId}.json`);
  }
  function exportAll() {
    if (!filtered.length) {
      toast.error("Nothing to export");
      return;
    }
    downloadJson(`apl-teams-${Date.now()}.json`, {
      exportedAt: new Date().toISOString(),
      count: filtered.length,
      teams: filtered.map(recordToExport),
    });
    toast.success(`Downloaded ${filtered.length} team(s)`);
  }
  function exportSelected() {
    const records = (data?.records || []).filter((r) => selected.has(r.registrationId));
    if (!records.length) {
      toast.error("Select at least one team");
      return;
    }
    downloadJson(`apl-teams-selected-${Date.now()}.json`, {
      exportedAt: new Date().toISOString(),
      count: records.length,
      teams: records.map(recordToExport),
    });
    toast.success(`Downloaded ${records.length} team(s)`);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <img src={aplLogo.url} alt="APL" className="h-9 w-9 rounded-full bg-white p-0.5" />
            <div className="font-display text-lg font-semibold">APL Admin</div>
          </Link>
          <div className="flex gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link to="/register">New Registration</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={onLogout} className="text-primary-foreground hover:bg-white/10">
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> Lock
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Toolbar */}
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-card">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search team, captain, ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={tournament} onValueChange={setTournament}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tournaments</SelectItem>
                <SelectItem value="APL">APL</SelectItem>
                <SelectItem value="ALPL">ALPL</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["registrations"] })}>
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isFetching && "animate-spin")} /> Refresh
            </Button>
            <Button size="sm" onClick={exportAll}>
              <FileJson className="mr-1.5 h-3.5 w-3.5" /> Export All JSON
            </Button>
          </div>
        </div>

        {/* Bulk actions bar */}
        {someChecked && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <span className="text-sm font-medium">
              {selected.size} selected
            </span>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={exportSelected}
                disabled={bulkBusy}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" /> Export selected
              </Button>
              <Button
                size="sm"
                className="bg-success text-white hover:bg-success/90"
                onClick={() => bulkSetStatus("Approved")}
                disabled={bulkBusy}
              >
                {bulkBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
                Approve selected
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => bulkSetStatus("Rejected")}
                disabled={bulkBusy}
              >
                {bulkBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <X className="mr-1.5 h-3.5 w-3.5" />}
                Reject selected
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={bulkBusy}>
                Clear
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center text-destructive">
            Failed to load registrations. Check that Google Sheets is connected.
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">
            No registrations found.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 w-10">
                      <Checkbox
                        checked={allVisibleChecked}
                        onCheckedChange={(v) => toggleAll(!!v)}
                        aria-label="Select all"
                      />
                    </th>
                    <th className="px-4 py-3">Reg ID</th>
                    <th className="px-4 py-3">Team</th>
                    <th className="px-4 py-3">Tournament</th>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Captain</th>
                    <th className="px-4 py-3">Players</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.registrationId} className="border-t border-border hover:bg-muted/30">
                      <td className="px-3 py-3">
                        <Checkbox
                          checked={selected.has(r.registrationId)}
                          onCheckedChange={(v) => toggleOne(r.registrationId, !!v)}
                          aria-label={`Select ${r.registrationId}`}
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold">{r.registrationId}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setDetail(r)}
                          className="flex items-center gap-2 text-left hover:text-accent"
                        >
                          {r.teamLogoUrl && (
                            <img src={r.teamLogoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                          )}
                          <span className="font-medium">{r.teamName || "—"}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3">{r.tournament}</td>
                      <td className="px-4 py-3">{r.batch}</td>
                      <td className="px-4 py-3">{r.captain.name}</td>
                      <td className="px-4 py-3">{1 + r.players.length}</td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <IconAction
                            title="Approve"
                            onClick={() => statusMut.mutate({ registrationId: r.registrationId, status: "Approved" })}
                            disabled={r.status === "Approved" || statusMut.isPending}
                            className="text-success hover:bg-success/10"
                          >
                            <Check className="h-4 w-4" />
                          </IconAction>
                          <IconAction
                            title="Reject"
                            onClick={() => statusMut.mutate({ registrationId: r.registrationId, status: "Rejected" })}
                            disabled={r.status === "Rejected" || statusMut.isPending}
                            className="text-destructive hover:bg-destructive/10"
                          >
                            <X className="h-4 w-4" />
                          </IconAction>
                          <IconAction title="Download JSON" onClick={() => exportOne(r)}>
                            <Download className="h-4 w-4" />
                          </IconAction>
                          <IconAction
                            title="Delete"
                            onClick={() => {
                              if (confirm(`Delete ${r.registrationId}?`)) deleteMut.mutate(r.registrationId);
                            }}
                            disabled={deleteMut.isPending}
                            className="text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </IconAction>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detail?.teamName || detail?.registrationId}</DialogTitle>
          </DialogHeader>
          {detail && <TeamDetail r={detail} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
            {detail && (
              <Button onClick={() => exportOne(detail)}>
                <Download className="mr-1.5 h-4 w-4" /> Download JSON
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Pending: "bg-warning/20 text-warning-foreground border-warning/40",
    Approved: "bg-success/20 text-success border-success/40",
    Rejected: "bg-destructive/20 text-destructive border-destructive/40",
  };
  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium", map[status] || map.Pending)}>
      {status}
    </span>
  );
}

function IconAction({
  children,
  title,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}

function TeamDetail({ r }: { r: RegistrationRecord }) {
  const all = [{ ...r.captain, isCaptain: true }, ...r.players.map((p) => ({ ...p, isCaptain: false }))];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-lg bg-muted/40 p-3">
        {r.teamLogoUrl && <img src={r.teamLogoUrl} alt="" className="h-16 w-16 rounded-full object-cover" />}
        <div className="min-w-0">
          <div className="text-xs uppercase text-muted-foreground">
            {r.tournament} · {r.batch} · {r.registrationId}
          </div>
          <div className="font-display text-xl font-bold">{r.teamName || "Unnamed Team"}</div>
          <div className="text-xs text-muted-foreground">
            Submitted {new Date(r.timestamp).toLocaleString()}
          </div>
        </div>
      </div>
      <div className="max-h-[50vh] space-y-2 overflow-y-auto">
        {all.map((p, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-2">
            {p.photoUrl && <img src={p.photoUrl} alt="" className="h-12 w-12 rounded-md object-cover" />}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-semibold">{p.name}</span>
                {p.isCaptain && (
                  <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent-foreground">C</span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">#{p.jersey}</span>
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {p.roles.join(", ")} · {p.battingStyle} · {p.bowlingStyle}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function recordToExport(r: RegistrationRecord) {
  return {
    registrationId: r.registrationId,
    timestamp: r.timestamp,
    status: r.status,
    tournament: r.tournament,
    batch: r.batch,
    teamName: r.teamName,
    teamLogoUrl: r.teamLogoUrl,
    captain: r.captain,
    players: r.players,
  };
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

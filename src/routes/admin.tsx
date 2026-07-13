import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  function exportOne(r: RegistrationRecord) {
    downloadJson(`${r.registrationId}.json`, recordToExport(r));
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
                          <IconAction title="Export JSON" onClick={() => exportOne(r)}>
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
                <Download className="mr-1.5 h-4 w-4" /> Export JSON
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
  a.click();
  URL.revokeObjectURL(url);
}

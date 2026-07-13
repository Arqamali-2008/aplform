import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  Upload,
  User,
  Users,
  Trophy,
  Shield,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import aplLogo from "@/assets/apl-logo.png.asset.json";

import {
  BATTING_STYLES,
  BOWLING_STYLES,
  ROLES,
  TOURNAMENTS,
  submitRegistration,
  uploadImage,
  type PlayerData,
} from "@/lib/apl-registration.functions";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Team Registration — APL / ALPL" },
      { name: "description", content: "Register your APL or ALPL cricket team in a few simple steps." },
      { property: "og:title", content: "Team Registration — APL / ALPL" },
      { property: "og:description", content: "Register your APL or ALPL cricket team." },
    ],
  }),
  component: RegisterPage,
});

type Player = {
  name: string;
  jersey: string;
  photoUrl: string;
  photoPreview: string;
  uploading: boolean;
  roles: string[];
  battingStyle: string;
  bowlingStyle: string;
};

type FormState = {
  tournament: string;
  batch: string;
  teamName: string;
  teamLogoUrl: string;
  teamLogoPreview: string;
  teamLogoUploading: boolean;
  captain: Player;
  players: Player[]; // additional players (Player 2..20)
};

const DRAFT_KEY = "apl_registration_draft_v1";

function emptyPlayer(): Player {
  return {
    name: "",
    jersey: "",
    photoUrl: "",
    photoPreview: "",
    uploading: false,
    roles: [],
    battingStyle: "Right Hand",
    bowlingStyle: "Does Not Bowl",
  };
}

function initialState(): FormState {
  return {
    tournament: "",
    batch: "",
    teamName: "",
    teamLogoUrl: "",
    teamLogoPreview: "",
    teamLogoUploading: false,
    captain: emptyPlayer(),
    players: [emptyPlayer(), emptyPlayer(), emptyPlayer(), emptyPlayer()], // minimum 5 total incl. captain
  };
}

const STEPS = [
  { id: 1, label: "Team", icon: Shield },
  { id: 2, label: "Captain", icon: User },
  { id: 3, label: "Players", icon: Users },
  { id: 4, label: "Review", icon: Trophy },
];

function RegisterPage() {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const upload = useServerFn(uploadImage);
  const submit = useServerFn(submitRegistration);

  // Load draft
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as FormState;
        // Reset transient upload flags
        parsed.teamLogoUploading = false;
        parsed.captain.uploading = false;
        parsed.players.forEach((p) => (p.uploading = false));
        setState(parsed);
      }
    } catch {}
  }, []);

  // Auto-save
  useEffect(() => {
    if (success) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
    } catch {}
  }, [state, success]);

  const totalPlayers = 1 + state.players.length;

  const setCaptain = (patch: Partial<Player>) =>
    setState((s) => ({ ...s, captain: { ...s.captain, ...patch } }));

  const setPlayer = (i: number, patch: Partial<Player>) =>
    setState((s) => ({
      ...s,
      players: s.players.map((p, idx) => (idx === i ? { ...p, ...patch } : p)),
    }));

  const addPlayer = () => {
    if (totalPlayers >= 20) return;
    setState((s) => ({ ...s, players: [...s.players, emptyPlayer()] }));
  };

  const removePlayer = (i: number) => {
    if (totalPlayers <= 5) return;
    setState((s) => ({ ...s, players: s.players.filter((_, idx) => idx !== i) }));
  };

  async function handleImageUpload(
    file: File,
    onProgress: (uploading: boolean) => void,
    onDone: (url: string, preview: string) => void,
  ) {
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image too large (max 8 MB)");
      return;
    }
    onProgress(true);
    const preview = URL.createObjectURL(file);
    onDone("", preview); // set preview immediately
    try {
      const base64 = await fileToBase64(file);
      const res = await upload({
        data: {
          filename: file.name,
          contentType: file.type || "image/jpeg",
          base64,
        },
      });
      onDone(res.url, preview);
      toast.success("Photo uploaded");
    } catch (e) {
      console.error(e);
      toast.error("Upload failed — try again");
    } finally {
      onProgress(false);
    }
  }

  function validateStep(n: number): string | null {
    if (n === 1) {
      if (!state.tournament) return "Please select a tournament";
      if (!state.batch.trim()) return "Please enter a team batch";
      if (!state.teamLogoUrl) return "Please upload a team logo";
    }
    if (n === 2) {
      const c = state.captain;
      if (!c.name.trim()) return "Captain name is required";
      if (!c.jersey.trim()) return "Captain jersey number is required";
      if (!c.photoUrl) return "Please upload captain photo";
      if (c.roles.length === 0) return "Select at least one role for captain";
    }
    if (n === 3) {
      if (totalPlayers < 5) return "Minimum 5 players (including captain)";
      if (totalPlayers > 20) return "Maximum 20 players (including captain)";
      const names = new Set<string>();
      const jerseys = new Set<string>();
      names.add(state.captain.name.trim().toLowerCase());
      jerseys.add(state.captain.jersey.trim());
      for (let i = 0; i < state.players.length; i++) {
        const p = state.players[i]!;
        if (!p.name.trim()) return `Player ${i + 2}: name required`;
        if (!p.jersey.trim()) return `Player ${i + 2}: jersey required`;
        if (!p.photoUrl) return `Player ${i + 2}: photo required`;
        if (p.roles.length === 0) return `Player ${i + 2}: select at least one role`;
        const nk = p.name.trim().toLowerCase();
        if (names.has(nk)) return `Duplicate player name: ${p.name}`;
        if (jerseys.has(p.jersey.trim())) return `Duplicate jersey number: ${p.jersey}`;
        names.add(nk);
        jerseys.add(p.jersey.trim());
      }
    }
    return null;
  }

  function goNext() {
    const err = validateStep(step);
    if (err) {
      toast.error(err);
      return;
    }
    setStep((s) => Math.min(4, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setStep((s) => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit() {
    for (let n = 1; n <= 3; n++) {
      const err = validateStep(n);
      if (err) {
        toast.error(err);
        setStep(n);
        return;
      }
    }
    setSubmitting(true);
    try {
      const payload = {
        tournament: state.tournament as (typeof TOURNAMENTS)[number],
        batch: state.batch.trim(),
        teamName: state.teamName.trim(),
        teamLogoUrl: state.teamLogoUrl,
        captain: playerToData(state.captain),
        players: state.players.map(playerToData),
      };
      const res = await submit({ data: payload });
      setSuccess(res.registrationId);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return <SuccessScreen registrationId={success} onNew={() => { setSuccess(null); setState(initialState()); setStep(1); }} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader />

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        {/* Progress */}
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            {STEPS.map((s) => {
              const active = s.id === step;
              const done = s.id < step;
              return (
                <div key={s.id} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                      active && "border-accent bg-accent text-accent-foreground",
                      done && "border-primary bg-primary text-primary-foreground",
                      !active && !done && "border-border bg-muted text-muted-foreground",
                    )}
                  >
                    {done ? <CheckCircle2 className="h-5 w-5" /> : <s.icon className="h-4 w-4" />}
                  </div>
                  <div
                    className={cn(
                      "text-xs font-medium",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {s.label}
                  </div>
                </div>
              );
            })}
          </div>
          <Progress value={(step / STEPS.length) * 100} className="h-2" />
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-card sm:p-8">
          {step === 1 && (
            <StepTeam
              state={state}
              setState={setState}
              onUpload={(file) =>
                handleImageUpload(
                  file,
                  (u) => setState((s) => ({ ...s, teamLogoUploading: u })),
                  (url, preview) =>
                    setState((s) => ({
                      ...s,
                      teamLogoPreview: preview,
                      teamLogoUrl: url || s.teamLogoUrl,
                    })),
                )
              }
            />
          )}
          {step === 2 && (
            <StepPlayer
              title="Captain Information"
              subtitle="Add the captain's details, photo, and playing style."
              player={state.captain}
              onChange={setCaptain}
              onUpload={(file) =>
                handleImageUpload(
                  file,
                  (u) => setCaptain({ uploading: u }),
                  (url, preview) =>
                    setCaptain({ photoPreview: preview, photoUrl: url || state.captain.photoUrl }),
                )
              }
            />
          )}
          {step === 3 && (
            <StepPlayers
              players={state.players}
              onChange={setPlayer}
              onAdd={addPlayer}
              onRemove={removePlayer}
              totalPlayers={totalPlayers}
              onUpload={(i, file) =>
                handleImageUpload(
                  file,
                  (u) => setPlayer(i, { uploading: u }),
                  (url, preview) =>
                    setPlayer(i, {
                      photoPreview: preview,
                      photoUrl: url || state.players[i]!.photoUrl,
                    }),
                )
              }
            />
          )}
          {step === 4 && <StepReview state={state} />}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
            <div className="flex gap-2">
              {step > 1 ? (
                <Button variant="outline" onClick={goBack} disabled={submitting}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
              ) : (
                <Button variant="ghost" asChild>
                  <Link to="/">Cancel</Link>
                </Button>
              )}
            </div>
            <div>
              {step < 4 ? (
                <Button onClick={goNext} size="lg">
                  Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} size="lg" disabled={submitting} className="bg-accent text-accent-foreground hover:bg-accent/90">
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…
                    </>
                  ) : (
                    <>Submit Registration</>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Your progress is saved on this device — you can safely refresh.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------ subcomponents ----------------------------- */

function PageHeader() {
  return (
    <header className="border-b border-border bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-3">
          <img src={aplLogo.url} alt="APL" className="h-9 w-9 rounded-full bg-white p-0.5" />
          <div className="font-display text-base font-semibold sm:text-lg">
            APL Team Registration
          </div>
        </Link>
        <Link to="/admin" className="text-sm hover:underline">
          Admin
        </Link>
      </div>
    </header>
  );
}

function ImagePicker({
  label,
  preview,
  uploading,
  onFile,
  round,
}: {
  label: string;
  preview: string;
  uploading: boolean;
  onFile: (f: File) => void;
  round?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative flex h-24 w-24 items-center justify-center overflow-hidden border-2 border-dashed border-border bg-muted transition-colors hover:border-accent",
          round ? "rounded-full" : "rounded-lg",
        )}
      >
        {preview ? (
          <img src={preview} alt="preview" className="h-full w-full object-cover" />
        ) : (
          <Upload className="h-6 w-6 text-muted-foreground" />
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/50 text-primary-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
      </button>
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="mr-2 h-3.5 w-3.5" />
          {preview ? "Change" : "Upload"} {label}
        </Button>
        <p className="mt-1 text-xs text-muted-foreground">PNG or JPG, up to 8 MB</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function StepTeam({
  state,
  setState,
  onUpload,
}: {
  state: FormState;
  setState: React.Dispatch<React.SetStateAction<FormState>>;
  onUpload: (f: File) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Team Information</h2>
        <p className="text-sm text-muted-foreground">Basic details about your team.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Tournament *</Label>
          <Select value={state.tournament} onValueChange={(v) => setState((s) => ({ ...s, tournament: v }))}>
            <SelectTrigger><SelectValue placeholder="Select tournament" /></SelectTrigger>
            <SelectContent>
              {TOURNAMENTS.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Team Batch *</Label>
          <Input
            value={state.batch}
            placeholder="e.g. Batch 2025"
            onChange={(e) => setState((s) => ({ ...s, batch: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Team Name (optional)</Label>
        <Input
          value={state.teamName}
          placeholder="e.g. Manar Strikers"
          onChange={(e) => setState((s) => ({ ...s, teamName: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label>Team Logo *</Label>
        <ImagePicker
          label="logo"
          preview={state.teamLogoPreview || state.teamLogoUrl}
          uploading={state.teamLogoUploading}
          onFile={onUpload}
          round
        />
      </div>
    </div>
  );
}

function StepPlayer({
  title,
  subtitle,
  player,
  onChange,
  onUpload,
}: {
  title: string;
  subtitle?: string;
  player: Player;
  onChange: (patch: Partial<Player>) => void;
  onUpload: (f: File) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <PlayerForm player={player} onChange={onChange} onUpload={onUpload} />
    </div>
  );
}

function PlayerForm({
  player,
  onChange,
  onUpload,
}: {
  player: Player;
  onChange: (patch: Partial<Player>) => void;
  onUpload: (f: File) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Name *</Label>
          <Input value={player.name} onChange={(e) => onChange({ name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Jersey Number *</Label>
          <Input
            inputMode="numeric"
            value={player.jersey}
            onChange={(e) => onChange({ jersey: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Photo *</Label>
        <ImagePicker
          label="photo"
          preview={player.photoPreview || player.photoUrl}
          uploading={player.uploading}
          onFile={onUpload}
        />
      </div>

      <div className="space-y-2">
        <Label>Roles * (select all that apply)</Label>
        <div className="flex flex-wrap gap-4">
          {ROLES.map((r) => {
            const checked = player.roles.includes(r);
            return (
              <label key={r} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => {
                    const set = new Set(player.roles);
                    if (v) set.add(r); else set.delete(r);
                    onChange({ roles: Array.from(set) });
                  }}
                />
                {r}
              </label>
            );
          })}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Batting Style *</Label>
          <RadioGroup
            value={player.battingStyle}
            onValueChange={(v) => onChange({ battingStyle: v })}
            className="flex gap-4"
          >
            {BATTING_STYLES.map((b) => (
              <label key={b} className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value={b} />
                {b}
              </label>
            ))}
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label>Bowling Style *</Label>
          <Select value={player.bowlingStyle} onValueChange={(v) => onChange({ bowlingStyle: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {BOWLING_STYLES.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function StepPlayers({
  players,
  onChange,
  onAdd,
  onRemove,
  onUpload,
  totalPlayers,
}: {
  players: Player[];
  onChange: (i: number, patch: Partial<Player>) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  onUpload: (i: number, f: File) => void;
  totalPlayers: number;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-2xl font-bold">Players</h2>
          <p className="text-sm text-muted-foreground">
            {totalPlayers} of 20 players (including captain). Minimum 5.
          </p>
        </div>
        <Button onClick={onAdd} disabled={totalPlayers >= 20} size="sm">
          <Plus className="mr-1.5 h-4 w-4" /> Add Player
        </Button>
      </div>

      <div className="space-y-4">
        {players.map((p, i) => (
          <div key={i} className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-display text-lg font-semibold">Player {i + 2}</div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(i)}
                disabled={totalPlayers <= 5}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="mr-1 h-4 w-4" /> Remove
              </Button>
            </div>
            <PlayerForm
              player={p}
              onChange={(patch) => onChange(i, patch)}
              onUpload={(f) => onUpload(i, f)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function StepReview({ state }: { state: FormState }) {
  const allPlayers = useMemo(
    () => [{ ...state.captain, isCaptain: true }, ...state.players.map((p) => ({ ...p, isCaptain: false }))],
    [state],
  );
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Review & Submit</h2>
        <p className="text-sm text-muted-foreground">Check the details before submitting.</p>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-lg bg-muted/40 p-4">
        {state.teamLogoPreview || state.teamLogoUrl ? (
          <img
            src={state.teamLogoPreview || state.teamLogoUrl}
            alt="team logo"
            className="h-20 w-20 rounded-full object-cover"
          />
        ) : (
          <div className="h-20 w-20 rounded-full bg-muted" />
        )}
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {state.tournament} · {state.batch}
          </div>
          <div className="font-display text-2xl font-bold">
            {state.teamName || "Unnamed Team"}
          </div>
          <div className="text-sm text-muted-foreground">{allPlayers.length} players</div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {allPlayers.map((p, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-3">
            <img
              src={p.photoPreview || p.photoUrl}
              alt={p.name}
              className="h-14 w-14 rounded-md object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-semibold">{p.name}</span>
                {p.isCaptain && (
                  <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent-foreground">
                    C
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">#{p.jersey}</span>
              </div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {p.roles.join(", ")} · {p.battingStyle} · {p.bowlingStyle}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SuccessScreen({ registrationId, onNew }: { registrationId: string; onNew: () => void }) {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader />
      <div className="mx-auto max-w-lg px-4 py-16 sm:py-24">
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-card">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success text-success-foreground">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold">Registration Submitted</h1>
          <p className="mt-2 text-muted-foreground">
            Thank you! Your team has been registered and is pending review.
          </p>
          <div className="mt-6 rounded-lg bg-muted/50 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Registration ID
            </div>
            <div className="font-display text-3xl font-bold text-cricket-navy">
              {registrationId}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button onClick={onNew} variant="outline">Register another team</Button>
            <Button asChild>
              <Link to="/">Back home</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- helpers -------------------------------- */

function playerToData(p: Player): PlayerData {
  return {
    name: p.name.trim(),
    jersey: p.jersey.trim(),
    photoUrl: p.photoUrl,
    roles: p.roles as PlayerData["roles"],
    battingStyle: p.battingStyle as PlayerData["battingStyle"],
    bowlingStyle: p.bowlingStyle as PlayerData["bowlingStyle"],
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

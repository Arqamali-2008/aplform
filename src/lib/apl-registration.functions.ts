import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const BATTING_STYLES = ["Right Hand", "Left Hand"] as const;

export const BOWLING_STYLES = [
  "Right Arm Fast",
  "Right Arm Medium",
  "Right Arm Off Spin",
  "Right Arm Leg Spin",
  "Left Arm Fast",
  "Left Arm Medium",
  "Left Arm Orthodox Spin",
  "Left Arm Wrist Spin (Chinaman)",
  "Does Not Bowl",
] as const;

export const ROLES = ["Batsman", "Bowler", "Wicket Keeper"] as const;

export const TOURNAMENTS = ["APL", "ALPL"] as const;

const playerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  jersey: z.string().trim().min(1).max(4),
  photoUrl: z.string().url(),
  roles: z.array(z.enum(ROLES)).min(1),
  battingStyle: z.enum(BATTING_STYLES),
  bowlingStyle: z.enum(BOWLING_STYLES),
});

export type PlayerData = z.infer<typeof playerSchema>;

const submissionSchema = z.object({
  tournament: z.enum(TOURNAMENTS),
  batch: z.string().trim().min(1).max(50),
  teamName: z.string().trim().max(80).optional().default(""),
  teamLogoUrl: z.string().url(),
  captain: playerSchema,
  players: z.array(playerSchema).min(4).max(19), // captain counts as player 1
});

export type SubmissionData = z.infer<typeof submissionSchema>;

export interface RegistrationRecord {
  registrationId: string;
  timestamp: string;
  tournament: string;
  batch: string;
  teamName: string;
  teamLogoUrl: string;
  captain: PlayerData;
  players: PlayerData[]; // additional players (Player 2..20)
  status: "Pending" | "Approved" | "Rejected";
  rowIndex: number;
}

function generateRegId(existingIds: string[], tournament: string): string {
  const prefix = tournament === "ALPL" ? "ALPL-" : "APL-";
  const nums = existingIds
    .filter((id) => id.startsWith(prefix))
    .map((id) => parseInt(id.slice(prefix.length), 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return prefix + String(next).padStart(5, "0");
}

function rowToRecord(row: string[], rowIndex: number): RegistrationRecord {
  const players: PlayerData[] = [];
  for (let i = 12; i < 12 + 19; i++) {
    const cell = row[i];
    if (cell && cell.trim()) {
      try {
        players.push(JSON.parse(cell) as PlayerData);
      } catch {
        // skip
      }
    }
  }
  const status = (row[12 + 19] as RegistrationRecord["status"]) || "Pending";
  return {
    registrationId: row[0] || "",
    timestamp: row[1] || "",
    tournament: row[2] || "",
    batch: row[3] || "",
    teamName: row[4] || "",
    teamLogoUrl: row[5] || "",
    captain: {
      name: row[6] || "",
      jersey: row[7] || "",
      photoUrl: row[8] || "",
      roles: (row[9] || "").split(",").map((s) => s.trim()).filter(Boolean) as PlayerData["roles"],
      battingStyle: (row[10] || "Right Hand") as PlayerData["battingStyle"],
      bowlingStyle: (row[11] || "Does Not Bowl") as PlayerData["bowlingStyle"],
    },
    players,
    status,
    rowIndex,
  };
}

function submissionToRow(reg: {
  registrationId: string;
  timestamp: string;
  status: string;
  data: SubmissionData;
}): string[] {
  const { data } = reg;
  const row: string[] = [
    reg.registrationId,
    reg.timestamp,
    data.tournament,
    data.batch,
    data.teamName || "",
    data.teamLogoUrl,
    data.captain.name,
    data.captain.jersey,
    data.captain.photoUrl,
    data.captain.roles.join(", "),
    data.captain.battingStyle,
    data.captain.bowlingStyle,
  ];
  for (let i = 0; i < 19; i++) {
    const p = data.players[i];
    row.push(p ? JSON.stringify(p) : "");
  }
  row.push(reg.status);
  return row;
}

// Upload a single image (base64) — called once per photo from the client for progress.
export const uploadImage = createServerFn({ method: "POST" })
  .inputValidator((data: { filename: string; contentType: string; base64: string }) => {
    return z
      .object({
        filename: z.string().min(1).max(200),
        contentType: z.string().min(1).max(100),
        base64: z.string().min(1),
      })
      .parse(data);
  })
  .handler(async ({ data }) => {
    const { uploadImageToDrive } = await import("./apl-google.server");
    const safe = data.filename.replace(/[^\w.\-]+/g, "_").slice(0, 120);
    const stamped = `${Date.now()}-${safe}`;
    const { url, fileId } = await uploadImageToDrive({
      filename: stamped,
      contentType: data.contentType,
      base64: data.base64,
    });
    return { url, fileId };
  });

export const submitRegistration = createServerFn({ method: "POST" })
  .inputValidator((data: SubmissionData) => submissionSchema.parse(data))
  .handler(async ({ data }) => {
    // Additional validation
    const allNames = [data.captain.name, ...data.players.map((p) => p.name)].map((n) =>
      n.trim().toLowerCase(),
    );
    if (new Set(allNames).size !== allNames.length) {
      throw new Error("Duplicate player names within the team");
    }
    const jerseys = [data.captain.jersey, ...data.players.map((p) => p.jersey)];
    if (new Set(jerseys).size !== jerseys.length) {
      throw new Error("Duplicate jersey numbers within the team");
    }

    const { getAllRows, appendRow } = await import("./apl-google.server");
    const rows = await getAllRows();
    const regId = generateRegId(
      rows.map((r) => r[0] || ""),
      data.tournament,
    );
    const row = submissionToRow({
      registrationId: regId,
      timestamp: new Date().toISOString(),
      status: "Pending",
      data,
    });
    await appendRow(row);
    return { registrationId: regId };
  });

export const listRegistrations = createServerFn({ method: "GET" }).handler(async () => {
  const { getAllRows } = await import("./apl-google.server");
  const rows = await getAllRows();
  const records: RegistrationRecord[] = [];
  rows.forEach((row, i) => {
    if (row && row[0]) records.push(rowToRecord(row, i + 2));
  });
  return { records };
});

export const setRegistrationStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { registrationId: string; status: "Pending" | "Approved" | "Rejected" }) =>
    z
      .object({
        registrationId: z.string().min(1),
        status: z.enum(["Pending", "Approved", "Rejected"]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { getAllRows, updateRowByIndex } = await import("./apl-google.server");
    const rows = await getAllRows();
    const idx = rows.findIndex((r) => r?.[0] === data.registrationId);
    if (idx < 0) throw new Error("Registration not found");
    const row = [...rows[idx]!];
    row[12 + 19] = data.status;
    await updateRowByIndex(idx + 2, row);
    return { ok: true };
  });

export const deleteRegistration = createServerFn({ method: "POST" })
  .inputValidator((data: { registrationId: string }) =>
    z.object({ registrationId: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { findRowIndexById, clearRowByIndex } = await import("./apl-google.server");
    const idx = await findRowIndexById(data.registrationId);
    if (!idx) throw new Error("Registration not found");
    await clearRowByIndex(idx);
    return { ok: true };
  });

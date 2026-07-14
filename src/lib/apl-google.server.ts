// Google Drive + Sheets helpers, called only from server functions.
// Uses the builder's connected Google account via the Lovable connector gateway.

const GATEWAY = "https://connector-gateway.lovable.dev";
const SHEET_NAME = "APL Team Registrations";
const FOLDER_NAME = "APL Uploads";
const TAB = "Registrations";

// The header row for the spreadsheet.
export const HEADERS = [
  "Registration ID",
  "Timestamp",
  "Tournament",
  "Team Batch",
  "Team Name",
  "Team Logo URL",
  "Captain Name",
  "Captain Jersey",
  "Captain Photo URL",
  "Captain Roles",
  "Captain Batting Style",
  "Captain Bowling Style",
  ...Array.from({ length: 19 }, (_, i) => `Player ${i + 2}`), // Player 2..Player 20
  "Status",
] as const;

export const NUM_COLS = HEADERS.length;

// module-level cache (worker instance lifetime)
let spreadsheetIdCache: string | null = null;
let folderIdCache: string | null = null;
let sheetTabIdCache: number | null = null;


function commonHeaders() {
  const key = process.env.LOVABLE_API_KEY;
  const dKey = process.env.GOOGLE_DRIVE_API_KEY;
  const sKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  return { drive: dKey, sheets: sKey, lovable: key };
}

async function driveFetch(path: string, init: RequestInit = {}) {
  const { lovable, drive } = commonHeaders();
  if (!drive) throw new Error("Google Drive not connected");
  const res = await fetch(`${GATEWAY}/google_drive${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${lovable}`,
      "X-Connection-Api-Key": drive,
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive ${res.status}: ${body}`);
  }
  return res;
}

async function sheetsFetch(path: string, init: RequestInit = {}) {
  const { lovable, sheets } = commonHeaders();
  if (!sheets) throw new Error("Google Sheets not connected");
  const res = await fetch(`${GATEWAY}/google_sheets${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${lovable}`,
      "X-Connection-Api-Key": sheets,
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets ${res.status}: ${body}`);
  }
  return res;
}

async function findFileByName(name: string, mimeType: string): Promise<string | null> {
  const q = encodeURIComponent(
    `name='${name.replace(/'/g, "\\'")}' and mimeType='${mimeType}' and trashed=false`,
  );
  const res = await driveFetch(`/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`);
  const data = (await res.json()) as { files?: Array<{ id: string }> };
  return data.files?.[0]?.id ?? null;
}

export async function getOrCreateFolder(): Promise<string> {
  if (folderIdCache) return folderIdCache;
  const existing = await findFileByName(FOLDER_NAME, "application/vnd.google-apps.folder");
  if (existing) {
    folderIdCache = existing;
    return existing;
  }
  const res = await driveFetch(`/drive/v3/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  const data = (await res.json()) as { id: string };
  folderIdCache = data.id;
  return data.id;
}

export async function getOrCreateSpreadsheet(): Promise<string> {
  if (spreadsheetIdCache) return spreadsheetIdCache;
  const existing = await findFileByName(SHEET_NAME, "application/vnd.google-apps.spreadsheet");
  if (existing) {
    spreadsheetIdCache = existing;
    await makePublic(existing).catch(() => {});
    return existing;
  }
  // Create it
  const res = await sheetsFetch(`/v4/spreadsheets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: { title: SHEET_NAME },
      sheets: [{ properties: { title: TAB } }],
    }),
  });
  const data = (await res.json()) as {
    spreadsheetId: string;
    sheets?: Array<{ properties: { sheetId: number; title: string } }>;
  };
  spreadsheetIdCache = data.spreadsheetId;
  const tab = data.sheets?.find((s) => s.properties.title === TAB);
  if (tab) sheetTabIdCache = tab.properties.sheetId;
  // Write headers
  await sheetsFetch(
    `/v4/spreadsheets/${data.spreadsheetId}/values/${TAB}!A1?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: [HEADERS as unknown as string[]] }),
    },
  );
  await makePublic(data.spreadsheetId).catch(() => {});
  return data.spreadsheetId;
}

async function getSheetTabId(): Promise<number> {
  if (sheetTabIdCache != null) return sheetTabIdCache;
  const id = await getOrCreateSpreadsheet();
  const res = await sheetsFetch(
    `/v4/spreadsheets/${id}?fields=sheets(properties(sheetId,title))`,
  );
  const data = (await res.json()) as {
    sheets: Array<{ properties: { sheetId: number; title: string } }>;
  };
  const tab = data.sheets.find((s) => s.properties.title === TAB);
  if (!tab) throw new Error(`Sheet tab "${TAB}" not found`);
  sheetTabIdCache = tab.properties.sheetId;
  return sheetTabIdCache;
}

async function makePublic(fileId: string) {
  await driveFetch(`/drive/v3/files/${fileId}/permissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
}


export async function uploadImageToDrive(params: {
  filename: string;
  contentType: string;
  base64: string;
}): Promise<{ fileId: string; url: string }> {
  const folderId = await getOrCreateFolder();
  const boundary = "-------lov" + Math.random().toString(36).slice(2);
  const metadata = { name: params.filename, parents: [folderId] };

  // Decode base64 to bytes
  const binary = Uint8Array.from(atob(params.base64), (c) => c.charCodeAt(0));

  const encoder = new TextEncoder();
  const preamble = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(metadata) +
      `\r\n--${boundary}\r\nContent-Type: ${params.contentType}\r\nContent-Transfer-Encoding: binary\r\n\r\n`,
  );
  const closing = encoder.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(preamble.length + binary.length + closing.length);
  body.set(preamble, 0);
  body.set(binary, preamble.length);
  body.set(closing, preamble.length + binary.length);

  const res = await driveFetch(`/upload/drive/v3/files?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  const data = (await res.json()) as { id: string };
  await makePublic(data.id);
  return {
    fileId: data.id,
    url: `https://drive.google.com/uc?export=view&id=${data.id}`,
  };
}

export async function appendRow(row: string[]) {
  const id = await getOrCreateSpreadsheet();
  await sheetsFetch(
    `/v4/spreadsheets/${id}/values/${TAB}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: [row] }),
    },
  );
}

export async function getAllRows(): Promise<string[][]> {
  const id = await getOrCreateSpreadsheet();
  const res = await sheetsFetch(`/v4/spreadsheets/${id}/values/${TAB}!A2:AZ10000`);
  const data = (await res.json()) as { values?: string[][] };
  return data.values ?? [];
}

// Update entire row at 1-indexed row number (A2 = row 2)
export async function updateRowByIndex(rowIndex: number, row: string[]) {
  const id = await getOrCreateSpreadsheet();
  const range = `${TAB}!A${rowIndex}`;
  await sheetsFetch(`/v4/spreadsheets/${id}/values/${range}?valueInputOption=RAW`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values: [row] }),
  });
}

// Clear a row (physical delete would require batchUpdate with sheetId; clearing is simpler)
export async function clearRowByIndex(rowIndex: number) {
  const id = await getOrCreateSpreadsheet();
  const range = `${TAB}!A${rowIndex}:AZ${rowIndex}`;
  await sheetsFetch(`/v4/spreadsheets/${id}/values/${range}:clear`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

// Find sheet row index (1-indexed, A2 = 2) by registration ID
export async function findRowIndexById(regId: string): Promise<number | null> {
  const rows = await getAllRows();
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]?.[0] === regId) return i + 2; // +2 because A2 is first data row
  }
  return null;
}

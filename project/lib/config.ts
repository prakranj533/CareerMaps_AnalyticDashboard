// Centralized environment-driven config for the dashboard
// Provide defaults so the app runs locally without envs, but prefer NEXT_PUBLIC_* at runtime

export const SHEET_ID = process.env.NEXT_PUBLIC_SHEET_ID || '1Oyz0XkemLeHjUQOBW1KrSKYTlhyvRfjXc3jNp9eZoSM';
export const SHEET_GID = process.env.NEXT_PUBLIC_SHEET_GID || '0';
export const DEFAULT_REFRESH_MS = Number(process.env.NEXT_PUBLIC_REFRESH_MS || 30000);

// Punch-in (attendance) form responses sheet
export const PUNCH_IN_SHEET_ID =
  process.env.NEXT_PUBLIC_PUNCH_IN_SHEET_ID || '18HJF-96eP2fioYvg90guMficXrokek7Zmlchoz_5d_s';
export const PUNCH_IN_SHEET_NAME = process.env.NEXT_PUBLIC_PUNCH_IN_SHEET_NAME || 'punch in';

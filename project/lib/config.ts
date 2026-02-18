// Centralized environment-driven config for the dashboard
// Provide defaults so the app runs locally without envs, but prefer NEXT_PUBLIC_* at runtime

export const SHEET_ID = process.env.NEXT_PUBLIC_SHEET_ID || '1Oyz0XkemLeHjUQOBW1KrSKYTlhyvRfjXc3jNp9eZoSM';
export const SHEET_GID = process.env.NEXT_PUBLIC_SHEET_GID || '0';
export const DEFAULT_REFRESH_MS = Number(process.env.NEXT_PUBLIC_REFRESH_MS || 30000);

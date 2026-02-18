const hasWindow = typeof window !== "undefined" && typeof window.btoa === "function";

const toBase64 = (value: string): string => {
  if (hasWindow) {
    return window.btoa(unescape(encodeURIComponent(value)));
  }
  return Buffer.from(value, "utf-8").toString("base64");
};

const fromBase64 = (value: string): string => {
  if (hasWindow && typeof window.atob === "function") {
    return decodeURIComponent(escape(window.atob(value)));
  }
  return Buffer.from(value, "base64").toString("utf-8");
};

const toBase64Url = (value: string): string =>
  toBase64(value).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

const fromBase64Url = (value: string): string => {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  return fromBase64(base64);
};

export const encodeShgSlug = (name: string): string => toBase64Url(name);
export const decodeShgSlug = (slug: string): string => {
  try {
    return fromBase64Url(slug);
  } catch (error) {
    console.error("Failed to decode SHG slug", error);
    return slug;
  }
};

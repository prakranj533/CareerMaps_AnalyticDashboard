import { fetchSheetTabAsObjects } from '@/lib/sheets';
import { SHEET_ID, SHEET_GID } from '@/lib/config';
import { encodeShgSlug } from '@/lib/shg-slug';
import ShgStudentsClient from './_client';

// Fetch all unique SHG names at build time for static export
export const dynamicParams = false;

export async function generateStaticParams() {
  try {
    const rows = await fetchSheetTabAsObjects({ sheetId: SHEET_ID, gid: SHEET_GID });
    const shgNames = new Set<string>();
    rows.forEach((r) => {
      const name = String(r['SHG Name'] ?? '').trim();
      if (name) shgNames.add(name);
    });
    return Array.from(shgNames).map((name) => ({ slug: encodeShgSlug(name) }));
  } catch (error) {
    console.error('Failed to fetch SHG names for static generation:', error);
    return [];
  }
}

export default function ShgStudentsPage({ params }: { params: { slug: string } }) {
  return <ShgStudentsClient params={params} />;
}

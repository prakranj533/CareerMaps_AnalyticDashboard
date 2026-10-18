import { fetchSheetTabAsObjects } from '@/lib/sheets';
import { SHEET_ID, SHEET_GID } from '@/lib/config';
import { canonicalizeShgName, encodeShgSlug } from '@/lib/shg-slug';
import ShgStudentsClient from './_client';

// Fetch all unique SHG names at build time for static export
export const dynamicParams = false;

export async function generateStaticParams() {
  try {
    const rows = await fetchSheetTabAsObjects({ sheetId: SHEET_ID, gid: SHEET_GID });
    const slugs = new Set<string>();
    rows.forEach((r) => {
      const name = String(r['SHG Name'] ?? '').trim();
      if (!name) return;
      // /shg links use the canonical name — emit slugs for both raw and
      // canonical spellings so spaced variants like "( 17:21:06)" resolve
      slugs.add(encodeShgSlug(name));
      slugs.add(encodeShgSlug(canonicalizeShgName(name)));
    });
    return Array.from(slugs).map((slug) => ({ slug }));
  } catch (error) {
    console.error('Failed to fetch SHG names for static generation:', error);
    return [];
  }
}

export default function ShgStudentsPage({ params }: { params: { slug: string } }) {
  return <ShgStudentsClient params={params} />;
}

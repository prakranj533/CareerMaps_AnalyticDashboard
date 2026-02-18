export type StudentSheetConfig = {
  sheetId: string;
  gid?: string | number;
};

/**
 * Map each SHG name (exactly as it appears in the /shg list) to the Google Sheet
 * and tab (gid) that stores its student roster. Add more entries here as you onboard
 * new SHGs with dedicated sheets/tabs.
 */
export const STUDENT_SHEET_MAP: Record<string, StudentSheetConfig> = {
  'SHG TC MIRZAPUR PURZAGIR(02:19:01)': {
    sheetId: '1OS5qhmei1YjZw6a-UcrRrGEANThQGiMM',
    gid: '1149390417',
  },
  'SHG TC SITAMARHI': {
    sheetId: '1OS5qhmei1YjZw6a-UcrRrGEANThQGiMM',
    gid: '89821039',
  },
  'SHG TC SITAMARHI&DARBHANGA BISFI(31:07:03)': {
    sheetId: '1OS5qhmei1YjZw6a-UcrRrGEANThQGiMM',
    gid: '89821039',
  },
  'SHG TC TIKAMGARH BIRDHA(23:21:02)': {
    sheetId: '1OS5qhmei1YjZw6a-UcrRrGEANThQGiMM',
    gid: '584753691',
  },
  'SHG TC SAMASTIPUR BIDUPUR(35:18:02)': {
    sheetId: '1OS5qhmei1YjZw6a-UcrRrGEANThQGiMM',
    gid: '889974174',
  },
  'SHG TC SARGUJA BARIYON(19:15:01)': {
    sheetId: '1OS5qhmei1YjZw6a-UcrRrGEANThQGiMM',
    gid: '1014497710',
  },
  'SHG TC AURANGABAD OBARA(20:02:01)': {
    sheetId: '1OS5qhmei1YjZw6a-UcrRrGEANThQGiMM',
    gid: '456444229',
  },
  'SHG TC MUZAFFARPUR BHUSRA(21:15:02)': {
    sheetId: '1OS5qhmei1YjZw6a-UcrRrGEANThQGiMM',
    gid: '1302481607',
  },
  'SHG TC BUXAR ITARAHI(06:10:02)': {
    sheetId: '1OS5qhmei1YjZw6a-UcrRrGEANThQGiMM',
    gid: '567312820',
  },
  'SHG TC GORAKHPUR BRAMHPUR(13:05:04)': {
    sheetId: '1OS5qhmei1YjZw6a-UcrRrGEANThQGiMM',
    gid: '1873718292',
  },
  'SHG TC AZAMGARH BHADSAR(07:20:03)': {
    sheetId: '1OS5qhmei1YjZw6a-UcrRrGEANThQGiMM',
    gid: '20392629',
  },
};

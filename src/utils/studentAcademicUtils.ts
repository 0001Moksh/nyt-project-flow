export interface RollNumberDetails {
  batchYear: number;
  branch: string;
  studentId: string;
}

export interface AcademicProgress {
  yearName: '1st Year' | '2nd Year' | '3rd Year' | 'Final Year';
  yearNumber: number;
  semesterName: string;
  semesterNumber: number;
}

/**
 * Parses a standard roll number format (e.g. 23AI35, 25CS42)
 */
export const parseRollNumber = (rollNo?: string): RollNumberDetails | null => {
  if (!rollNo || typeof rollNo !== 'string') return null;
  const cleaned = rollNo.trim().toUpperCase();
  const match = cleaned.match(/^(\d{2})([A-Z]{2,4})(\d+)$/);
  if (!match) return null;

  const yearDigits = parseInt(match[1], 10);
  const batchYear = 2000 + yearDigits;
  const branch = match[2];
  const studentId = match[3];

  return { batchYear, branch, studentId };
};

/**
 * Calculates dynamic B.Tech Year and Semester based on roll number and current date.
 * Assumes B.Tech academic session starts in August of the admission batch year.
 */
export const calculateAcademicProgress = (
  rollNo?: string,
  referenceDate: Date = new Date()
): AcademicProgress | null => {
  const parsed = parseRollNumber(rollNo);
  if (!parsed) return null;

  const { batchYear } = parsed;
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth(); // 0-indexed: 0 = Jan, 7 = Aug

  // Academic year starts in August (Month index 7)
  let yearDiff = refYear - batchYear;
  if (refMonth >= 7) {
    // Current date is in August-December (Autumn Semester)
    yearDiff += 1;
  }

  // Bound year between 1 and 4 for standard B.Tech
  const yearNumber = Math.max(1, Math.min(4, yearDiff));

  // Determine semester number:
  // In August-December (month >= 7): Odd semester (1st, 3rd, 5th, 7th) -> (yearNumber * 2) - 1
  // In January-July (month < 7): Even semester (2nd, 4th, 6th, 8th) -> yearNumber * 2
  let semesterNumber: number;
  if (refMonth >= 7) {
    semesterNumber = yearNumber * 2 - 1;
  } else {
    semesterNumber = yearNumber * 2;
  }
  semesterNumber = Math.max(1, Math.min(8, semesterNumber));

  const yearNameMap: Record<number, '1st Year' | '2nd Year' | '3rd Year' | 'Final Year'> = {
    1: '1st Year',
    2: '2nd Year',
    3: '3rd Year',
    4: 'Final Year',
  };

  const yearName = yearNameMap[yearNumber] || 'Final Year';
  const semesterName = `${semesterNumber}${getOrdinalSuffix(semesterNumber)} Semester`;

  return {
    yearName,
    yearNumber,
    semesterName,
    semesterNumber,
  };
};

const getOrdinalSuffix = (n: number): string => {
  if (n === 1) return 'st';
  if (n === 2) return 'nd';
  if (n === 3) return 'rd';
  return 'th';
};

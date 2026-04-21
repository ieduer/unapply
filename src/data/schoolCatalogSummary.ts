import { officialSchoolCatalogMeta } from './officialSchoolMeta';

export const officialSchoolCount = officialSchoolCatalogMeta.ordinaryCount;
export const officialUndergraduateCount = officialSchoolCatalogMeta.undergraduateCount;
export const officialVocationalCount = officialSchoolCatalogMeta.vocationalCount;
export const adultHigherEducationCount = officialSchoolCatalogMeta.adultCount;
export const totalHigherEducationCount = officialSchoolCatalogMeta.totalHigherEducationCount;

// Manual enhancement rows in src/data/schools.ts. Keep this in sync when curatedSchools changes.
export const curatedEnhancementCount = 125;

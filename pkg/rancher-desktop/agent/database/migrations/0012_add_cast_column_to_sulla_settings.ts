export const up = `
  ALTER TABLE sulla_settings ADD COLUMN "cast" TEXT;
`;

export const down = `
  ALTER TABLE sulla_settings DROP COLUMN "cast";
`;

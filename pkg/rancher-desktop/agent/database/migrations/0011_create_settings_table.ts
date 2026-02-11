export const up = `
  CREATE TABLE sulla_settings (
    property TEXT PRIMARY KEY,
    value JSONB NOT NULL
  );
`;

export const down = `DROP TABLE IF EXISTS settings;`;

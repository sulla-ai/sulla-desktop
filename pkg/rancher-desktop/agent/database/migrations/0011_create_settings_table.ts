export const up = `
  CREATE TABLE sulla_settings (
    property TEXT PRIMARY KEY,
    value TEXT 
  );
`;

export const down = `DROP TABLE IF EXISTS settings;`;

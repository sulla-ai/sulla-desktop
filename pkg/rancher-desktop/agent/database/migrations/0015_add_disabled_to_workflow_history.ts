export const up = `
  ALTER TABLE workflow_history
    ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT FALSE;
`;

export const down = `
  ALTER TABLE workflow_history
    DROP COLUMN IF EXISTS disabled;
`;

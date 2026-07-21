/*
  # Add index for policies.client_id

  ## Changes
  - Creates an index on policies.client_id to improve query performance when fetching policies for a specific client
  - This is a non-breaking change that improves performance for the ClientDetail policies tab
*/

CREATE INDEX IF NOT EXISTS idx_policies_client_id ON policies(client_id);

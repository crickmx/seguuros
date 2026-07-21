/*
  # Remove next_payment_date and simplify policies

  ## Changes
  
  1. Schema Changes
    - Remove `next_payment_date` column from policies table
    - This simplifies policy management by only requiring start_date
    - End date will be calculated automatically as start_date + 1 year in the application
  
  2. Notes
    - Existing policies will retain their current end_date values
    - No data loss occurs from this migration
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policies' AND column_name = 'next_payment_date'
  ) THEN
    ALTER TABLE policies DROP COLUMN next_payment_date;
  END IF;
END $$;

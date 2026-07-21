/*
  # Remove duplicate interaction trigger

  1. Changes
    - Drop the trigger and function that creates duplicate interactions
    - The activity_feed system now handles all activity tracking
    - This prevents duplicate entries in the interactions table
*/

-- Drop the trigger
DROP TRIGGER IF EXISTS trigger_activity_from_interaction ON interactions;

-- Drop the function
DROP FUNCTION IF EXISTS create_activity_from_interaction();

/*
  # Fix Phone Numbers to Always Use +521 Format

  1. Changes
    - Update all phone numbers in prospects table to use +521 format
    - Update all phone numbers in clients table to use +521 format  
    - Update all phone numbers in wa_conversations table to use +521 format
    - Convert +52 (12 digits) to +521 (13 digits) format for Mexican cell phones

  2. Security
    - No RLS changes (data migration only)

  3. Notes
    - This ensures consistency across all phone number formats
    - Mexican cell phones should always have +521 prefix
    - Example: +525512345678 becomes +5215512345678
*/

-- Update prospects table - phone field
UPDATE prospects
SET phone = '+521' || substring(phone from 4)
WHERE phone ~ '^\+52[0-9]{10}$'
  AND phone !~ '^\+521';

-- Update clients table - phone field
UPDATE clients
SET phone = '+521' || substring(phone from 4)
WHERE phone ~ '^\+52[0-9]{10}$'
  AND phone !~ '^\+521';

-- Update wa_conversations table - contact_phone_e164
UPDATE wa_conversations
SET contact_phone_e164 = '+521' || substring(contact_phone_e164 from 4)
WHERE contact_phone_e164 ~ '^\+52[0-9]{10}$'
  AND contact_phone_e164 !~ '^\+521';

-- Update wa_conversations table - contact_plain (without + sign)
UPDATE wa_conversations
SET contact_plain = '521' || substring(contact_plain from 3)
WHERE contact_plain ~ '^52[0-9]{10}$'
  AND contact_plain !~ '^521';
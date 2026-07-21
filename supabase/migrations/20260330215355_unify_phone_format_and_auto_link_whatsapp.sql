/*
  # Unificar formato de teléfono y vinculación automática con WhatsApp

  1. Funciones creadas
    - `normalize_phone_to_521(text)` - Normaliza cualquier teléfono mexicano al formato +521XXXXXXXXXX
    
  2. Actualizaciones de datos
    - Normaliza teléfonos existentes en `prospects` al formato +521
    - Normaliza teléfonos existentes en `clients` al formato +521
    - Normaliza teléfonos existentes en `profiles` al formato +521
    - Normaliza teléfonos existentes en `email_ingest_messages` al formato +521
    
  3. Triggers creados
    - Auto-vinculación de conversaciones WhatsApp con prospects/clients cuando se crea una conversación
    - Auto-vinculación de conversaciones WhatsApp cuando se crea/actualiza un prospect/client
    - Normalización automática de teléfonos en insert/update de prospects, clients, profiles
    
  4. Vinculación de datos existentes
    - Se vinculan automáticamente las conversaciones existentes con sus respectivos leads/clientes
*/

-- Crear función para normalizar teléfonos al formato +521XXXXXXXXXX
CREATE OR REPLACE FUNCTION normalize_phone_to_521(phone_input text)
RETURNS text AS $$
DECLARE
  cleaned text;
BEGIN
  IF phone_input IS NULL OR phone_input = '' THEN
    RETURN phone_input;
  END IF;
  
  -- Remover espacios, paréntesis, guiones
  cleaned := regexp_replace(phone_input, '[^0-9+]', '', 'g');
  
  -- Si ya tiene el formato correcto +521XXXXXXXXXX (13 dígitos con +521)
  IF cleaned ~ '^\+521[0-9]{10}$' THEN
    RETURN cleaned;
  END IF;
  
  -- Si empieza con +52 pero no tiene el 1 (formato viejo +52XXXXXXXXXX)
  IF cleaned ~ '^\+52[0-9]{10}$' THEN
    RETURN '+521' || substring(cleaned from 4);
  END IF;
  
  -- Si empieza con 521 sin + (521XXXXXXXXXX)
  IF cleaned ~ '^521[0-9]{10}$' THEN
    RETURN '+' || cleaned;
  END IF;
  
  -- Si empieza con 52 sin + y sin 1 (52XXXXXXXXXX)
  IF cleaned ~ '^52[0-9]{10}$' THEN
    RETURN '+521' || substring(cleaned from 3);
  END IF;
  
  -- Si es un número de 10 dígitos sin código de país
  IF cleaned ~ '^[0-9]{10}$' THEN
    RETURN '+521' || cleaned;
  END IF;
  
  -- Si no coincide con ningún patrón, devolver el original
  RETURN phone_input;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Actualizar teléfonos existentes en prospects
UPDATE prospects 
SET phone = normalize_phone_to_521(phone)
WHERE phone IS NOT NULL AND phone != '';

-- Actualizar teléfonos existentes en clients
UPDATE clients 
SET phone = normalize_phone_to_521(phone)
WHERE phone IS NOT NULL AND phone != '';

-- Actualizar teléfonos existentes en profiles
UPDATE profiles 
SET phone = normalize_phone_to_521(phone)
WHERE phone IS NOT NULL AND phone != '';

-- Actualizar teléfonos existentes en email_ingest_messages
UPDATE email_ingest_messages 
SET parsed_phone = normalize_phone_to_521(parsed_phone)
WHERE parsed_phone IS NOT NULL AND parsed_phone != '';

-- Crear función para vincular conversación de WhatsApp con prospect/client
CREATE OR REPLACE FUNCTION link_whatsapp_conversation()
RETURNS trigger AS $$
DECLARE
  normalized_phone text;
  found_prospect_id uuid;
  found_client_id uuid;
BEGIN
  -- Normalizar el teléfono de la conversación
  normalized_phone := normalize_phone_to_521(NEW.contact_phone_e164);
  
  -- Si ya está vinculado, no hacer nada
  IF NEW.prospect_id IS NOT NULL OR NEW.client_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Buscar primero en clients (prioridad a clientes sobre prospects)
  SELECT id INTO found_client_id
  FROM clients
  WHERE normalize_phone_to_521(phone) = normalized_phone
  LIMIT 1;
  
  IF found_client_id IS NOT NULL THEN
    NEW.client_id := found_client_id;
    RETURN NEW;
  END IF;
  
  -- Si no se encontró cliente, buscar en prospects
  SELECT id INTO found_prospect_id
  FROM prospects
  WHERE normalize_phone_to_521(phone) = normalized_phone
  LIMIT 1;
  
  IF found_prospect_id IS NOT NULL THEN
    NEW.prospect_id := found_prospect_id;
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para vincular conversaciones cuando se crean
DROP TRIGGER IF EXISTS trigger_link_whatsapp_conversation_on_insert ON wa_conversations;
CREATE TRIGGER trigger_link_whatsapp_conversation_on_insert
  BEFORE INSERT ON wa_conversations
  FOR EACH ROW
  EXECUTE FUNCTION link_whatsapp_conversation();

-- Función para actualizar vinculación cuando se crea/actualiza un prospect/client
CREATE OR REPLACE FUNCTION update_whatsapp_links_on_contact_change()
RETURNS trigger AS $$
DECLARE
  normalized_phone text;
BEGIN
  -- Normalizar el teléfono
  normalized_phone := normalize_phone_to_521(NEW.phone);
  
  -- Si es un client, actualizar conversaciones (clients tienen prioridad sobre prospects)
  IF TG_TABLE_NAME = 'clients' THEN
    UPDATE wa_conversations
    SET 
      client_id = NEW.id,
      prospect_id = NULL
    WHERE normalize_phone_to_521(contact_phone_e164) = normalized_phone
      AND (client_id IS NULL OR client_id != NEW.id);
      
  -- Si es un prospect, solo actualizar si no hay client vinculado
  ELSIF TG_TABLE_NAME = 'prospects' THEN
    UPDATE wa_conversations
    SET prospect_id = NEW.id
    WHERE normalize_phone_to_521(contact_phone_e164) = normalized_phone
      AND client_id IS NULL
      AND (prospect_id IS NULL OR prospect_id != NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers para actualizar vinculaciones cuando se crean/actualizan prospects/clients
DROP TRIGGER IF EXISTS trigger_update_whatsapp_links_on_prospect_change ON prospects;
CREATE TRIGGER trigger_update_whatsapp_links_on_prospect_change
  AFTER INSERT OR UPDATE OF phone ON prospects
  FOR EACH ROW
  WHEN (NEW.phone IS NOT NULL AND NEW.phone != '')
  EXECUTE FUNCTION update_whatsapp_links_on_contact_change();

DROP TRIGGER IF EXISTS trigger_update_whatsapp_links_on_client_change ON clients;
CREATE TRIGGER trigger_update_whatsapp_links_on_client_change
  AFTER INSERT OR UPDATE OF phone ON clients
  FOR EACH ROW
  WHEN (NEW.phone IS NOT NULL AND NEW.phone != '')
  EXECUTE FUNCTION update_whatsapp_links_on_contact_change();

-- Función para normalizar teléfono automáticamente en insert/update
CREATE OR REPLACE FUNCTION normalize_phone_on_change()
RETURNS trigger AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    NEW.phone := normalize_phone_to_521(NEW.phone);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para normalizar teléfonos automáticamente
DROP TRIGGER IF EXISTS trigger_normalize_phone_prospects ON prospects;
CREATE TRIGGER trigger_normalize_phone_prospects
  BEFORE INSERT OR UPDATE OF phone ON prospects
  FOR EACH ROW
  EXECUTE FUNCTION normalize_phone_on_change();

DROP TRIGGER IF EXISTS trigger_normalize_phone_clients ON clients;
CREATE TRIGGER trigger_normalize_phone_clients
  BEFORE INSERT OR UPDATE OF phone ON clients
  FOR EACH ROW
  EXECUTE FUNCTION normalize_phone_on_change();

DROP TRIGGER IF EXISTS trigger_normalize_phone_profiles ON profiles;
CREATE TRIGGER trigger_normalize_phone_profiles
  BEFORE INSERT OR UPDATE OF phone ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION normalize_phone_on_change();

-- Vincular conversaciones existentes con clients (prioridad)
UPDATE wa_conversations wc
SET 
  client_id = c.id,
  prospect_id = NULL
FROM clients c
WHERE normalize_phone_to_521(wc.contact_phone_e164) = normalize_phone_to_521(c.phone)
  AND c.phone IS NOT NULL AND c.phone != ''
  AND wc.client_id IS NULL;

-- Vincular conversaciones existentes con prospects (solo si no tienen client)
UPDATE wa_conversations wc
SET prospect_id = p.id
FROM prospects p
WHERE normalize_phone_to_521(wc.contact_phone_e164) = normalize_phone_to_521(p.phone)
  AND p.phone IS NOT NULL AND p.phone != ''
  AND wc.client_id IS NULL
  AND wc.prospect_id IS NULL;

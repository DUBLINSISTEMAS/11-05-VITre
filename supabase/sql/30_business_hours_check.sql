-- ADR-0023 — Horários da loja
-- CHECK constraint mínimo: business_hours, quando não-null, precisa ser um
-- objeto jsonb (não array, não escalar). Validação semântica (formato HH:MM,
-- shifts contíguos, etc) é responsabilidade do Zod na server action.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'store_business_hours_object'
  ) THEN
    ALTER TABLE store
      ADD CONSTRAINT store_business_hours_object
      CHECK (business_hours IS NULL OR jsonb_typeof(business_hours) = 'object');
  END IF;
END
$$;

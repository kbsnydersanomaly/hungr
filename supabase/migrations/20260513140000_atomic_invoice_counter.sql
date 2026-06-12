-- Atomic invoice counter to prevent race conditions
-- When two invoices are generated concurrently, this ensures unique sequential numbers.
-- Uses row-level locking (FOR UPDATE) within the transaction.

CREATE OR REPLACE FUNCTION increment_invoice_counter(p_org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  old_seq integer;
BEGIN
  -- Lock the existing counter row for this org
  SELECT next_seq INTO old_seq
  FROM invoice_counters
  WHERE org_id = p_org_id
  FOR UPDATE;

  IF FOUND THEN
    -- Increment and return the previous value
    UPDATE invoice_counters
    SET next_seq = old_seq + 1
    WHERE org_id = p_org_id;
    RETURN old_seq;
  ELSE
    -- First invoice for this org — seed counter at 2, return 1
    INSERT INTO invoice_counters (org_id, next_seq)
    VALUES (p_org_id, 2);
    RETURN 1;
  END IF;
END;
$$;

COMMENT ON FUNCTION increment_invoice_counter(uuid) IS
  'Atomically increments and returns the next invoice sequence number for an organization. Safe for concurrent use.';

-- Audit log append-only enforcement.
-- Blocks UPDATE and DELETE on audit_log from inside the application.
-- A DBA can DROP TRIGGER ... to perform a one-off purge.

CREATE OR REPLACE FUNCTION audit_log_block_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only (operation % rejected)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log;
CREATE TRIGGER audit_log_no_update
BEFORE UPDATE ON audit_log
FOR EACH ROW EXECUTE FUNCTION audit_log_block_mutation();

DROP TRIGGER IF EXISTS audit_log_no_delete ON audit_log;
CREATE TRIGGER audit_log_no_delete
BEFORE DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION audit_log_block_mutation();

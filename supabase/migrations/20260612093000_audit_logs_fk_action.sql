-- Companion to 20260612092000: audit_logs.acting_as_user_id also blocked
-- user deletion (no ON DELETE action).
alter table audit_logs drop constraint audit_logs_acting_as_user_id_fkey;
alter table audit_logs add constraint audit_logs_acting_as_user_id_fkey
  foreign key (acting_as_user_id) references profiles(id) on delete set null;

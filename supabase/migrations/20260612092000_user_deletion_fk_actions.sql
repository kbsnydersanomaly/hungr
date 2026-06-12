-- Deleting an auth user currently fails with "Database error deleting user"
-- because several FKs to profiles(id) have no ON DELETE action. Every user
-- owns an auto-created org (handle_new_user), so user deletion was impossible.
--
-- Ownership rows go with the user; audit-style references are kept but nulled.

-- The user's organization is deleted with them (cascades to restaurants etc.).
alter table organizations drop constraint organizations_owner_id_fkey;
alter table organizations add constraint organizations_owner_id_fkey
  foreign key (owner_id) references profiles(id) on delete cascade;

-- Invitations they sent disappear with them.
alter table invitations drop constraint invitations_invited_by_fkey;
alter table invitations add constraint invitations_invited_by_fkey
  foreign key (invited_by) references profiles(id) on delete cascade;

-- Audit references: keep the row, drop the user pointer.
alter table organization_members drop constraint organization_members_invited_by_fkey;
alter table organization_members add constraint organization_members_invited_by_fkey
  foreign key (invited_by) references profiles(id) on delete set null;

alter table branding drop constraint branding_updated_by_fkey;
alter table branding add constraint branding_updated_by_fkey
  foreign key (updated_by) references profiles(id) on delete set null;

alter table branding_drafts drop constraint branding_drafts_updated_by_fkey;
alter table branding_drafts add constraint branding_drafts_updated_by_fkey
  foreign key (updated_by) references profiles(id) on delete set null;

alter table reviews drop constraint reviews_moderated_by_fkey;
alter table reviews add constraint reviews_moderated_by_fkey
  foreign key (moderated_by) references profiles(id) on delete set null;

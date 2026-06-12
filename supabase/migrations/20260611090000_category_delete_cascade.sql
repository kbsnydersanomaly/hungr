-- Allow deleting a category to remove its items as well (UI confirms first).
alter table menu_items
  drop constraint menu_items_category_id_fkey;

alter table menu_items
  add constraint menu_items_category_id_fkey
    foreign key (category_id) references categories(id) on delete cascade;

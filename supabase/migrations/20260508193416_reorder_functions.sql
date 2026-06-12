-- Reorder functions: single RPC instead of N round-trips

create or replace function reorder_categories(p_menu_id uuid, p_ids uuid[])
returns void language plpgsql as $$
declare
  i int;
begin
  for i in 1..array_length(p_ids, 1) loop
    update public.categories
    set sort_order = i - 1
    where id = p_ids[i] and menu_id = p_menu_id;
  end loop;
end $$;

create or replace function reorder_items(p_menu_id uuid, p_category_id uuid, p_ids uuid[])
returns void language plpgsql as $$
declare
  i int;
begin
  for i in 1..array_length(p_ids, 1) loop
    update public.menu_items
    set sort_order = i - 1, category_id = p_category_id
    where id = p_ids[i] and menu_id = p_menu_id;
  end loop;
end $$;

-- Combo specials need a flat bundle price (e.g. "Burger + Fries + Drink = R99"),
-- which is distinct from the percentage / fixed-amount discount used by other kinds.
alter table specials
  add column if not exists combo_price_cents int;

comment on column specials.combo_price_cents is
  'Flat total price (in cents) for a combo special. Only used when kind = ''combo''.';

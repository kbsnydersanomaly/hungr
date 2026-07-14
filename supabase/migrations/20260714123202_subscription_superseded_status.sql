-- Add 'superseded' status for subscription rows replaced by a new payment method.

alter type subscription_status add value if not exists 'superseded';

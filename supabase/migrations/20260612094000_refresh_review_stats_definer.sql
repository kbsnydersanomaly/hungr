-- The reviews_after_change trigger refreshes the review_stats materialized
-- view, but the view is owned by postgres. When another role causes a review
-- delete (e.g. GoTrue cascading an auth user deletion), the refresh fails
-- with "permission denied for materialized view review_stats" and aborts the
-- whole operation. Run the refresh as the function owner instead.
alter function public.refresh_review_stats() security definer;

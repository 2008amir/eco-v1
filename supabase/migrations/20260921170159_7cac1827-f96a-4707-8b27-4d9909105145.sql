
REVOKE EXECUTE ON FUNCTION public.admin_review_payment(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_position(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_revoked(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_pending_payments(text) FROM anon;

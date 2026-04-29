REVOKE EXECUTE ON FUNCTION public.notify_member(uuid, uuid, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tg_notify_member_on_invoice() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tg_notify_member_on_payment() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tg_notify_member_on_benefit_booking() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tg_notify_member_on_benefit_credit() FROM PUBLIC, anon;
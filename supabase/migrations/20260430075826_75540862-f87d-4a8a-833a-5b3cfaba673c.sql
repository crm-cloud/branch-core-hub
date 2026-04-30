REVOKE ALL ON FUNCTION public.howbody_touch_device(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.howbody_touch_device(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.howbody_touch_device(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.howbody_touch_device(TEXT) TO service_role;
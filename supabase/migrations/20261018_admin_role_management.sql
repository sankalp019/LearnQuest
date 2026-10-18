-- Secure role assignment: users cannot grant themselves privileges.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_set_profile_role(p_user_id uuid, p_role text, p_reason text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_old_role text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_role NOT IN ('student','teacher','campus_admin','super_admin') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  SELECT role INTO v_actor_role FROM public.profiles WHERE id = v_actor;
  IF v_actor_role <> 'super_admin' THEN RAISE EXCEPTION 'Super admin access required'; END IF;
  IF p_user_id = v_actor AND p_role <> 'super_admin' THEN RAISE EXCEPTION 'You cannot remove your own super admin role'; END IF;
  SELECT role INTO v_old_role FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  UPDATE public.profiles SET role = p_role, updated_at = now() WHERE id = p_user_id;
  INSERT INTO public.admin_audit_log(actor_id, action, target_type, target_id, reason, metadata)
  VALUES (v_actor, 'profile.role_changed', 'profile', p_user_id::text, left(trim(COALESCE(p_reason,'')), 500), jsonb_build_object('from',v_old_role,'to',p_role));
  RETURN jsonb_build_object('ok',true,'user_id',p_user_id,'role',p_role);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_profile_role(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_profile_role(uuid,text,text) TO authenticated;
COMMIT;

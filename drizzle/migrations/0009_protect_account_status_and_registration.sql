CREATE OR REPLACE FUNCTION public.enforce_registration_progress()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE approved boolean;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    IF NEW.registered_at IS DISTINCT FROM OLD.registered_at OR NEW.member_no IS DISTINCT FROM OLD.member_no OR NEW.account_status IS DISTINCT FROM OLD.account_status OR NEW.is_revoked IS DISTINCT FROM OLD.is_revoked THEN
      RAISE EXCEPTION 'Only an administrator can change verification or account status';
    END IF;
  END IF;
  IF NEW.onboarding_step > 0 AND (OLD.onboarding_step = 0 OR NEW.onboarding_step IS DISTINCT FROM OLD.onboarding_step) THEN
    IF nullif(btrim(NEW.first_name),'') IS NULL OR nullif(btrim(NEW.middle_name),'') IS NULL OR nullif(btrim(NEW.username),'') IS NULL OR nullif(btrim(NEW.phone),'') IS NULL OR nullif(btrim(NEW.gender),'') IS NULL OR NEW.date_of_birth IS NULL OR nullif(btrim(NEW.city),'') IS NULL OR nullif(btrim(NEW.state),'') IS NULL OR nullif(btrim(NEW.country),'') IS NULL OR nullif(btrim(NEW.address_line1),'') IS NULL OR nullif(btrim(NEW.home_number),'') IS NULL OR nullif(btrim(NEW.home_email),'') IS NULL OR nullif(btrim(NEW.institution),'') IS NULL OR nullif(btrim(NEW.course_of_study),'') IS NULL OR nullif(btrim(NEW.program_of_study),'') IS NULL OR NEW.is_graduate IS NULL OR (NEW.is_graduate AND nullif(btrim(NEW.graduation_year),'') IS NULL) OR (NOT NEW.is_graduate AND nullif(btrim(NEW.school_level),'') IS NULL) OR nullif(btrim(NEW.guardian_name),'') IS NULL OR nullif(btrim(NEW.guardian_phone),'') IS NULL OR nullif(btrim(NEW.guardian_address),'') IS NULL OR nullif(btrim(NEW.guardian_relationship),'') IS NULL OR nullif(btrim(NEW.emergency_name),'') IS NULL OR nullif(btrim(NEW.emergency_relationship),'') IS NULL OR nullif(btrim(NEW.emergency_phone),'') IS NULL OR nullif(btrim(NEW.id_full_name),'') IS NULL OR nullif(btrim(NEW.blood_group),'') IS NULL OR nullif(btrim(NEW.id_phone),'') IS NULL OR nullif(btrim(NEW.signature_data),'') IS NULL THEN
      RAISE EXCEPTION 'Complete the membership form before continuing';
    END IF;
  END IF;
  IF NEW.onboarding_step >= 2 AND OLD.onboarding_step < 2 AND NEW.policy_accepted_at IS NULL THEN
    RAISE EXCEPTION 'Accept the organization policy before continuing';
  END IF;
  IF NEW.onboarding_step >= 3 AND OLD.onboarding_step < 3 AND NOT EXISTS (SELECT 1 FROM public.payments WHERE user_id = NEW.id AND kind = 'registration' AND status IN ('pending', 'verified')) THEN
    RAISE EXCEPTION 'Submit a registration payment before continuing';
  END IF;
  IF NEW.onboarding_step >= 6 AND (OLD.onboarding_step < 6 OR NEW.registered_at IS DISTINCT FROM OLD.registered_at OR NEW.member_no IS DISTINCT FROM OLD.member_no) THEN
    SELECT EXISTS (SELECT 1 FROM public.payments WHERE user_id = NEW.id AND kind = 'registration' AND status = 'verified') INTO approved;
    IF NOT approved OR NEW.registered_at IS NULL OR NEW.member_no IS NULL THEN
      RAISE EXCEPTION 'Administrator payment approval is required before dashboard access';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.admin_set_account_status(_user_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF _status NOT IN ('active', 'suspended', 'banned') THEN RAISE EXCEPTION 'Invalid account status'; END IF;
  IF public.has_role(_user_id, 'admin') THEN RAISE EXCEPTION 'Administrator accounts cannot be restricted'; END IF;
  UPDATE public.profiles SET account_status=_status, is_revoked=(_status='banned'), updated_at=now() WHERE id=_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.admin_set_account_status(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_account_status(uuid,text) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.enforce_registration_progress()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE approved boolean;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.payments
    WHERE user_id = NEW.id AND kind = 'registration' AND status = 'verified'
  ) AND NEW.registered_at IS NOT NULL AND NEW.member_no IS NOT NULL AND NEW.policy_accepted_at IS NOT NULL
    AND nullif(btrim(NEW.first_name),'') IS NOT NULL AND nullif(btrim(NEW.middle_name),'') IS NOT NULL
    AND nullif(btrim(NEW.username),'') IS NOT NULL AND nullif(btrim(NEW.phone),'') IS NOT NULL
    AND nullif(btrim(NEW.gender),'') IS NOT NULL AND NEW.date_of_birth IS NOT NULL
    AND nullif(btrim(NEW.city),'') IS NOT NULL AND nullif(btrim(NEW.state),'') IS NOT NULL
    AND nullif(btrim(NEW.country),'') IS NOT NULL AND nullif(btrim(NEW.address_line1),'') IS NOT NULL
    AND nullif(btrim(NEW.home_number),'') IS NOT NULL AND nullif(btrim(NEW.home_email),'') IS NOT NULL
    AND nullif(btrim(NEW.institution),'') IS NOT NULL AND nullif(btrim(NEW.course_of_study),'') IS NOT NULL
    AND nullif(btrim(NEW.program_of_study),'') IS NOT NULL AND NEW.is_graduate IS NOT NULL
    AND ((NEW.is_graduate AND nullif(btrim(NEW.graduation_year),'') IS NOT NULL) OR (NOT NEW.is_graduate AND nullif(btrim(NEW.school_level),'') IS NOT NULL))
    AND nullif(btrim(NEW.guardian_name),'') IS NOT NULL AND nullif(btrim(NEW.guardian_phone),'') IS NOT NULL
    AND nullif(btrim(NEW.guardian_address),'') IS NOT NULL AND nullif(btrim(NEW.guardian_relationship),'') IS NOT NULL
    AND nullif(btrim(NEW.emergency_name),'') IS NOT NULL AND nullif(btrim(NEW.emergency_relationship),'') IS NOT NULL
    AND nullif(btrim(NEW.emergency_phone),'') IS NOT NULL AND nullif(btrim(NEW.id_full_name),'') IS NOT NULL
    AND nullif(btrim(NEW.blood_group),'') IS NOT NULL AND nullif(btrim(NEW.id_phone),'') IS NOT NULL
    AND nullif(btrim(NEW.signature_data),'') IS NOT NULL THEN
    NEW.onboarding_step := GREATEST(COALESCE(NEW.onboarding_step, 0), 6);
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    IF NEW.registered_at IS DISTINCT FROM OLD.registered_at OR NEW.member_no IS DISTINCT FROM OLD.member_no THEN
      RAISE EXCEPTION 'Only an administrator can verify registration';
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
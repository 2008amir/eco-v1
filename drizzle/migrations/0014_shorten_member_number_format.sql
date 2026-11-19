CREATE OR REPLACE FUNCTION public.generate_member_no()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alphabet constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  candidate text;
  first_part text;
  second_part text;
  i integer;
BEGIN
  LOOP
    first_part := '';
    second_part := '';
    FOR i IN 1..2 LOOP
      first_part := first_part || substr(alphabet, floor(random() * length(alphabet))::integer + 1, 1);
    END LOOP;
    FOR i IN 1..3 LOOP
      second_part := second_part || substr(alphabet, floor(random() * length(alphabet))::integer + 1, 1);
    END LOOP;
    candidate := 'EMS/' || first_part || '/' || second_part;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE member_no = candidate);
  END LOOP;
  RETURN candidate;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_member_no() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_member_no() TO service_role;

COMMENT ON FUNCTION public.generate_member_no() IS 'Generates a unique random member number in the format EMS/XX/XXX (2 characters, then 3 characters).';
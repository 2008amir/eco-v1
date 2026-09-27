import type { Profile } from "@/lib/auth-context";

const REQUIRED_FIELDS = [
  "first_name", "middle_name", "username", "phone", "gender", "date_of_birth",
  "city", "state", "country", "address_line1", "home_number", "home_email",
  "institution", "course_of_study", "program_of_study", "guardian_name",
  "guardian_phone", "guardian_address", "guardian_relationship", "emergency_name",
  "emergency_relationship", "emergency_phone", "id_full_name", "blood_group",
  "id_phone", "signature_data",
] as const;

export function isRegistrationComplete(profile: Profile | null) {
  if (!profile) return false;
  const fields = profile as unknown as Record<string, unknown>;
  return REQUIRED_FIELDS.every((field) => String(fields[field] ?? "").trim() !== "")
    && profile.is_graduate !== null && profile.is_graduate !== undefined
    && (profile.is_graduate ? Boolean(profile.graduation_year?.trim()) : Boolean(profile.school_level?.trim()))
    && Boolean(profile.policy_accepted_at)
    && Boolean(profile.registered_at && profile.member_no)
    && profile.registration_payment_verified === true
    && (profile.onboarding_step ?? 0) >= 6;
}
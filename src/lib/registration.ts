import type { Profile } from "@/lib/auth-context";

const REQUIRED_FIELDS = [
  "first_name", "middle_name", "username", "phone", "gender", "date_of_birth",
  "city", "state", "country", "address_line1", "home_number", "home_email",
  "institution", "course_of_study", "program_of_study", "guardian_name",
  "guardian_phone", "guardian_address", "guardian_relationship", "emergency_name",
  "emergency_relationship", "emergency_phone", "id_full_name", "blood_group",
  "id_phone", "signature_data",
] as const;

export function isRegistrationFormComplete(profile: Profile | null) {
  if (!profile) return false;
  const fields = profile as unknown as Record<string, unknown>;
  return REQUIRED_FIELDS.every((field) => String(fields[field] ?? "").trim() !== "")
    && profile.is_graduate !== null && profile.is_graduate !== undefined
    && (profile.is_graduate ? Boolean(profile.graduation_year?.trim()) : Boolean(profile.school_level?.trim()));
}

export function isRegistrationComplete(profile: Profile | null) {
  if (!profile) return false;
  return isRegistrationFormComplete(profile)
    && Boolean(profile.policy_accepted_at)
    && Boolean(profile.registered_at && profile.member_no)
    && profile.registration_payment_verified === true;
}

/**
 * An administrator-approved member: payment verified, member number issued and
 * registration finished. Once true, editing the profile must never send the
 * person back to the registration pages.
 */
export function isMemberApproved(profile: Profile | null) {
  if (!profile) return false;
  return profile.registration_payment_verified === true
    && Boolean(profile.registered_at && profile.member_no)
    && (profile.onboarding_step ?? 0) >= 6;
}

const FIELD_LABELS: Record<string, string> = {
  first_name: "First name", middle_name: "Middle name", username: "Username", phone: "Phone number",
  gender: "Gender", date_of_birth: "Date of birth", city: "City", state: "State", country: "Country",
  address_line1: "Address line 1", home_number: "Home number", home_email: "Home email",
  institution: "Institution", course_of_study: "Course of study", program_of_study: "Program of study",
  is_graduate: "Graduated?", graduation_year: "Year of graduation", school_level: "Level in school",
  guardian_name: "Parent/guardian name", guardian_phone: "Parent/guardian phone",
  guardian_address: "Parent/guardian address", guardian_relationship: "Parent/guardian relationship",
  emergency_name: "Emergency contact name", emergency_relationship: "Emergency contact relationship",
  emergency_phone: "Emergency contact phone", id_full_name: "ID card full name", blood_group: "Blood group",
  id_phone: "ID card phone", signature: "Signature",
};

const FORM_REQUIRED_KEYS = REQUIRED_FIELDS.filter((key) => key !== "signature_data");

/** Lists the labels of required membership-form answers that are still empty. */
export function missingMemberFields(form: Record<string, string | undefined | null>, signature: string | null): string[] {
  const missing: string[] = [];
  for (const key of [...FORM_REQUIRED_KEYS.slice(0, 15), "is_graduate", ...FORM_REQUIRED_KEYS.slice(15)]) {
    if (String(form[key] ?? "").trim() === "") missing.push(FIELD_LABELS[key] ?? key);
  }
  if (form.is_graduate === "yes" && !String(form.graduation_year ?? "").trim()) missing.push(FIELD_LABELS.graduation_year);
  if (form.is_graduate === "no" && !String(form.school_level ?? "").trim()) missing.push(FIELD_LABELS.school_level);
  if (!signature) missing.push(FIELD_LABELS.signature);
  return missing;
}

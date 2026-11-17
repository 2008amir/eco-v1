import { describe, expect, it } from "vitest";
import { isRegistrationComplete } from "./registration";
import type { Profile } from "./auth-context";

const completeProfile = {
  first_name: "Amina",
  last_name: null,
  middle_name: "Zainab",
  username: "amina",
  country: "Nigeria",
  phone: "08000000000",
  avatar_url: null,
  gender: "Female",
  date_of_birth: "2000-01-01",
  city: "Lagos",
  state: "Lagos",
  address_line1: "1 Main Street",
  address_line2: null,
  address_line3: null,
  home_number: "08000000000",
  home_email: "home@example.com",
  institution: "University",
  course_of_study: "Health",
  program_of_study: "BSc",
  is_graduate: false,
  graduation_year: null,
  school_level: "300 Level",
  guardian_name: "Parent",
  guardian_phone: "08000000001",
  guardian_address: "2 Main Street",
  guardian_relationship: "Parent",
  emergency_name: "Friend",
  emergency_relationship: "Friend",
  emergency_phone: "08000000002",
  id_full_name: "Amina Zainab",
  blood_group: "A+",
  id_phone: "08000000000",
  signature_data: "data:image/png;base64,signature",
  policy_accepted_at: "2026-11-17T00:00:00.000Z",
  registered_at: "2026-11-17T00:00:00.000Z",
  member_no: "EMS/AB12/CD34",
  registration_payment_verified: true,
  onboarding_step: 1,
} as unknown as Profile;

const profileWith = (overrides: Partial<Profile>) => ({ ...completeProfile, ...overrides }) as Profile;

describe("isRegistrationComplete", () => {
  it("lets fully completed, payment-approved members proceed even if an old step value is stale", () => {
    expect(isRegistrationComplete(completeProfile)).toBe(true);
  });

  it("does not consider registration complete before the policy was accepted", () => {
    expect(isRegistrationComplete(profileWith({ policy_accepted_at: null }))).toBe(false);
  });

  it("does not consider registration complete until an ID number is issued", () => {
    expect(isRegistrationComplete(profileWith({ member_no: null }))).toBe(false);
  });

  it("does not let a member proceed before an administrator verifies payment", () => {
    expect(isRegistrationComplete(profileWith({ registration_payment_verified: false }))).toBe(false);
  });

  it("keeps required form fields mandatory while allowing the three optional details to be blank", () => {
    expect(isRegistrationComplete(profileWith({ last_name: null, address_line2: null, address_line3: null }))).toBe(true);
    expect(isRegistrationComplete(profileWith({ middle_name: "" }))).toBe(false);
  });
});
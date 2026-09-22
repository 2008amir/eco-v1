import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CountrySelect } from "@/components/CountrySelect";
import { SignaturePad } from "@/components/SignaturePad";

export const PROGRAMS = ["NCE", "ND", "HND", "BSc", "MHD", "PhD"];
export const GENDERS = ["Male", "Female", "Other", "Prefer not to say"];
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export const SCHOOL_LEVELS = ["100 Level", "200 Level", "300 Level", "400 Level", "500 Level", "Postgraduate"];

export type FormState = Record<string, string>;

export const EMPTY_MEMBER_FORM: FormState = {
  first_name: "", last_name: "", middle_name: "", username: "", phone: "", gender: "", date_of_birth: "",
  city: "", state: "", country: "", address_line1: "", address_line2: "", address_line3: "",
  home_number: "", home_email: "",
  institution: "", course_of_study: "", program_of_study: "", is_graduate: "", graduation_year: "", school_level: "",
  guardian_name: "", guardian_phone: "", guardian_address: "", guardian_relationship: "",
  emergency_name: "", emergency_relationship: "", emergency_phone: "",
  id_full_name: "", blood_group: "", id_phone: "",
  avatar_url: "",
};

export function buildProfilePayload(form: FormState, signature: string | null) {
  return {
    first_name: form.first_name,
    last_name: form.last_name,
    middle_name: form.middle_name || null,
    username: form.username,
    phone: form.phone,
    gender: form.gender || null,
    date_of_birth: form.date_of_birth || null,
    city: form.city || null,
    state: form.state || null,
    country: form.country,
    address_line1: form.address_line1 || null,
    address_line2: form.address_line2 || null,
    address_line3: form.address_line3 || null,
    home_number: form.home_number || null,
    home_email: form.home_email || null,
    institution: form.institution || null,
    course_of_study: form.course_of_study || null,
    program_of_study: form.program_of_study || null,
    is_graduate: form.is_graduate === "yes" ? true : form.is_graduate === "no" ? false : null,
    graduation_year: form.is_graduate === "yes" ? form.graduation_year || null : null,
    school_level: form.is_graduate === "no" ? form.school_level || null : null,
    guardian_name: form.guardian_name || null,
    guardian_phone: form.guardian_phone || null,
    guardian_address: form.guardian_address || null,
    guardian_relationship: form.guardian_relationship || null,
    emergency_name: form.emergency_name || null,
    emergency_relationship: form.emergency_relationship || null,
    emergency_phone: form.emergency_phone || null,
    id_full_name: form.id_full_name || null,
    blood_group: form.blood_group || null,
    id_phone: form.id_phone || null,
    signature_data: signature,
    updated_at: new Date().toISOString(),
  };
}

export function Section({ index, title, children }: { index: number; title: string; children: ReactNode }) {
  return (
    <section className="glass-strong rounded-2xl p-5 sm:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full gradient-bg text-primary-foreground text-sm font-bold">{index}</span>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function Field({ label, children, full = false }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

type Props = {
  form: FormState;
  onChange: (key: string, value: string) => void;
  signature: string | null;
  onSignatureChange: (v: string | null) => void;
  email: string;
  positionName?: string;
  memberNo?: string | null;
};

export function MemberForm({ form, onChange, signature, onSignatureChange, email, positionName, memberNo }: Props) {
  return (
    <>
      <Section index={1} title="Personal information">
        <Field label="First name"><Input value={form.first_name} onChange={(e) => onChange("first_name", e.target.value)} className="glass" /></Field>
        <Field label="Last name (optional)"><Input value={form.last_name} onChange={(e) => onChange("last_name", e.target.value)} className="glass" /></Field>
        <Field label="Middle name"><Input value={form.middle_name} onChange={(e) => onChange("middle_name", e.target.value)} className="glass" /></Field>
        <Field label="Phone number"><Input value={form.phone} onChange={(e) => onChange("phone", e.target.value)} className="glass" /></Field>
        <Field label="Gender">
          <Select value={form.gender} onValueChange={(v) => onChange("gender", v)}>
            <SelectTrigger className="glass w-full"><SelectValue placeholder="Select gender" /></SelectTrigger>
            <SelectContent>{GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Date of birth"><Input type="date" value={form.date_of_birth} onChange={(e) => onChange("date_of_birth", e.target.value)} className="glass" /></Field>
        <Field label="Email address" full><Input value={email} disabled className="glass opacity-60" /></Field>
        <Field label="Username" full><Input value={form.username} onChange={(e) => onChange("username", e.target.value)} className="glass" /></Field>
      </Section>

      <Section index={2} title="Address">
        <Field label="City"><Input value={form.city} onChange={(e) => onChange("city", e.target.value)} className="glass" /></Field>
        <Field label="State"><Input value={form.state} onChange={(e) => onChange("state", e.target.value)} className="glass" /></Field>
        <Field label="Country" full><CountrySelect value={form.country} onChange={(v) => onChange("country", v)} /></Field>
        <Field label="Address line 1" full><Input value={form.address_line1} onChange={(e) => onChange("address_line1", e.target.value)} className="glass" /></Field>
        <Field label="Address line 2" full><Input value={form.address_line2} onChange={(e) => onChange("address_line2", e.target.value)} className="glass" /></Field>
        <Field label="Address line 3" full><Input value={form.address_line3} onChange={(e) => onChange("address_line3", e.target.value)} className="glass" /></Field>
        <Field label="Home number"><Input value={form.home_number} onChange={(e) => onChange("home_number", e.target.value)} className="glass" /></Field>
        <Field label="Home email"><Input type="email" value={form.home_email} onChange={(e) => onChange("home_email", e.target.value)} className="glass" /></Field>
      </Section>

      <Section index={3} title="Educational status">
        <Field label="Institution"><Input value={form.institution} onChange={(e) => onChange("institution", e.target.value)} className="glass" /></Field>
        <Field label="Course of study"><Input value={form.course_of_study} onChange={(e) => onChange("course_of_study", e.target.value)} className="glass" /></Field>
        <Field label="Program of study">
          <Select value={form.program_of_study} onValueChange={(v) => onChange("program_of_study", v)}>
            <SelectTrigger className="glass w-full"><SelectValue placeholder="Select program" /></SelectTrigger>
            <SelectContent>{PROGRAMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Graduated?">
          <Select value={form.is_graduate} onValueChange={(v) => onChange("is_graduate", v)}>
            <SelectTrigger className="glass w-full"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {form.is_graduate === "yes" && (
          <Field label="Year of graduation" full>
            <Input inputMode="numeric" placeholder="e.g. 2024" value={form.graduation_year} onChange={(e) => onChange("graduation_year", e.target.value)} className="glass" />
          </Field>
        )}
        {form.is_graduate === "no" && (
          <Field label="Level in school" full>
            <Select value={form.school_level} onValueChange={(v) => onChange("school_level", v)}>
              <SelectTrigger className="glass w-full"><SelectValue placeholder="Select level" /></SelectTrigger>
              <SelectContent>{SCHOOL_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        )}
      </Section>

      <Section index={4} title="Parent or guardian">
        <Field label="Name of parent/guardian"><Input value={form.guardian_name} onChange={(e) => onChange("guardian_name", e.target.value)} className="glass" /></Field>
        <Field label="Phone no"><Input value={form.guardian_phone} onChange={(e) => onChange("guardian_phone", e.target.value)} className="glass" /></Field>
        <Field label="Address" full><Input value={form.guardian_address} onChange={(e) => onChange("guardian_address", e.target.value)} className="glass" /></Field>
        <Field label="Relationship"><Input value={form.guardian_relationship} onChange={(e) => onChange("guardian_relationship", e.target.value)} className="glass" /></Field>
      </Section>

      <Section index={5} title="Emergency contact">
        <Field label="Name"><Input value={form.emergency_name} onChange={(e) => onChange("emergency_name", e.target.value)} className="glass" /></Field>
        <Field label="Relationship"><Input value={form.emergency_relationship} onChange={(e) => onChange("emergency_relationship", e.target.value)} className="glass" /></Field>
        <Field label="Phone number" full><Input value={form.emergency_phone} onChange={(e) => onChange("emergency_phone", e.target.value)} className="glass" /></Field>
      </Section>

      <Section index={6} title="ID card details">
        <Field label="Full name" full><Input value={form.id_full_name} onChange={(e) => onChange("id_full_name", e.target.value)} className="glass" /></Field>
        <Field label="Blood group">
          <Select value={form.blood_group} onValueChange={(v) => onChange("blood_group", v)}>
            <SelectTrigger className="glass w-full"><SelectValue placeholder="Select blood group" /></SelectTrigger>
            <SelectContent>{BLOOD_GROUPS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Phone no"><Input value={form.id_phone} onChange={(e) => onChange("id_phone", e.target.value)} className="glass" /></Field>
        <Field label="Type"><Input value={positionName ?? "Member"} disabled className="glass opacity-60" /></Field>
        <Field label="ID no"><Input value={memberNo ?? "Issued after verification"} disabled className="glass opacity-60" /></Field>
        <Field label="Signature" full><SignaturePad value={signature} onChange={onSignatureChange} /></Field>
      </Section>
    </>
  );
}

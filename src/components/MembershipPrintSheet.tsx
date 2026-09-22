import { ORG_POLICY_TITLE } from "@/lib/policy";
import { usePolicyText } from "@/lib/org-policy";

type Props = {
  profile: Record<string, any> | null;
  email: string;
  positionName: string;
  memberNo: string | null;
};

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ display: "flex", gap: 8, padding: "4px 0", borderBottom: "1px solid #e5e7eb" }}>
      <div style={{ width: 200, color: "#4b5563", fontSize: 12 }}>{label}</div>
      <div style={{ flex: 1, fontSize: 12, color: "#111827" }}>{value ? String(value) : "—"}</div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: "#14532d", marginBottom: 4 }}>{title}</div>
      {children}
    </div>
  );
}

/** Printable membership form (page 1) + organization policy (page 2). */
export function MembershipPrintSheet({ profile, email, positionName, memberNo }: Props) {
  const p = profile ?? {};
  const { data: policyText } = usePolicyText("form");
  return (
    <div className="print-sheet" style={{ background: "#ffffff", color: "#111827", padding: 32, fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div className="print-page">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: "#14532d", margin: 0 }}>Ecomedic Squad — Membership Form</h1>
          <div style={{ fontSize: 12, fontWeight: 700 }}>Form no: {memberNo ?? "—"}</div>
        </div>

        <Group title="1. Personal information">
          <Row label="First name" value={p.first_name} />
          <Row label="Last name" value={p.last_name} />
          <Row label="Middle name" value={p.middle_name} />
          <Row label="Phone number" value={p.phone} />
          <Row label="Gender" value={p.gender} />
          <Row label="Date of birth" value={p.date_of_birth} />
          <Row label="Email address" value={email} />
          <Row label="Username" value={p.username} />
        </Group>

        <Group title="2. Address">
          <Row label="City" value={p.city} />
          <Row label="State" value={p.state} />
          <Row label="Country" value={p.country} />
          <Row label="Address line 1" value={p.address_line1} />
          <Row label="Address line 2" value={p.address_line2} />
          <Row label="Address line 3" value={p.address_line3} />
          <Row label="Home number" value={p.home_number} />
          <Row label="Home email" value={p.home_email} />
        </Group>

        <Group title="3. Educational status">
          <Row label="Institution" value={p.institution} />
          <Row label="Course of study" value={p.course_of_study} />
          <Row label="Program of study" value={p.program_of_study} />
          <Row label="Graduated?" value={p.is_graduate === true ? "Yes" : p.is_graduate === false ? "No" : ""} />
          <Row label={p.is_graduate ? "Year of graduation" : "Level in school"} value={p.is_graduate ? p.graduation_year : p.school_level} />
        </Group>

        <Group title="4. Parent or guardian">
          <Row label="Name" value={p.guardian_name} />
          <Row label="Phone no" value={p.guardian_phone} />
          <Row label="Address" value={p.guardian_address} />
          <Row label="Relationship" value={p.guardian_relationship} />
        </Group>

        <Group title="5. Emergency contact">
          <Row label="Name" value={p.emergency_name} />
          <Row label="Relationship" value={p.emergency_relationship} />
          <Row label="Phone number" value={p.emergency_phone} />
        </Group>

        <Group title="6. ID card details">
          <Row label="Full name" value={p.id_full_name} />
          <Row label="Blood group" value={p.blood_group} />
          <Row label="Phone no" value={p.id_phone} />
          <Row label="Type" value={positionName} />
          <Row label="ID no" value={memberNo} />
        </Group>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 4 }}>Signature</div>
          {p.signature_data
            ? <img src={p.signature_data} alt="Signature" style={{ height: 80, border: "1px solid #e5e7eb" }} />
            : <div style={{ height: 80, border: "1px solid #e5e7eb" }} />}
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>Printed on {new Date().toLocaleDateString()}</div>
        </div>
      </div>

      <div className="print-break" />

      <div className="print-page">
        <h1 style={{ fontSize: 18, fontWeight: 800, color: "#14532d" }}>{ORG_POLICY_TITLE}</h1>
        {(policyText ?? "").split(/\n\s*\n/).filter((t) => t.trim()).map((t, i) => (
          <p key={i} style={{ fontSize: 12, lineHeight: 1.6, margin: "10px 0 0", whiteSpace: "pre-line" }}>{t}</p>
        ))}
        <div style={{ marginTop: 24, fontSize: 12 }}>
          Accepted by: <strong>{[p.first_name, p.last_name].filter(Boolean).join(" ") || p.username}</strong>
          {memberNo ? ` (Form no: ${memberNo})` : ""}
        </div>
      </div>
    </div>
  );
}

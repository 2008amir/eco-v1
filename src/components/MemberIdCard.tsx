import frontTemplate from "@/assets/id-card-front-template-v2.png";
import backTemplate from "@/assets/id-card-back-template-v2.png";
import { ID_CARD_DEFAULT_POLICY } from "@/lib/org-policy";

type MemberIdCardProps = {
  side: "front" | "back";
  fullName: string;
  positionName: string;
  bloodGroup: string;
  phone: string;
  memberNo: string;
  avatarUrl?: string | null;
  qr?: string | null;
  signature?: string | null;
  policy?: string;
  issued?: string;
};

export function MemberIdCard(props: MemberIdCardProps) {
  if (props.side === "back") {
    const hasCustomPolicy = Boolean(props.policy?.trim() && props.policy.trim() !== ID_CARD_DEFAULT_POLICY);
    return (
      <section
        className="member-id-card member-id-card-back"
        aria-label="Back of ID card"
        style={{ backgroundImage: `url(${backTemplate})` }}
      >
        <div className={hasCustomPolicy ? "member-card-policy is-custom" : "member-card-policy"}>
          {hasCustomPolicy && <p>{props.policy}</p>}
        </div>
        <div className="member-card-issued">{props.issued || "—"}</div>
      </section>
    );
  }

  return (
    <section
      className="member-id-card member-id-card-front"
      aria-label="Front of ID card"
      style={{ backgroundImage: `url(${frontTemplate})` }}
    >
      <div className="member-card-details">
        <dl>
          <div><dd>{props.fullName || "—"}</dd></div>
          <div><dd>{props.positionName || "—"}</dd></div>
          <div><dd>{props.bloodGroup || "—"}</dd></div>
          <div><dd>{props.phone || "—"}</dd></div>
        </dl>
      </div>

      <div className="member-card-photo">
        {props.avatarUrl ? <img src={props.avatarUrl} alt="Member" /> : <span>PHOTO</span>}
      </div>
      <div className="member-card-number">{props.memberNo || "—"}</div>

      <div className="member-card-verify">
        {props.qr ? <img src={props.qr} alt="Verification QR code" /> : <span />}
        <strong>SCAN FOR<br />VERIFICATION</strong>
      </div>

      <div className="member-card-signature">
        {props.signature ? <img src={props.signature} alt="Signature" /> : <span>{props.fullName || "Signature"}</span>}
      </div>
    </section>
  );
}
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import logoSrc from "@/assets/id-card-logo.png";
import frontTemplate from "@/assets/id-card-front-template-v2.png";
import backTemplate from "@/assets/id-card-back-template-v2.png";
import formTemplate from "@/assets/personal-information-form.pdf.asset.json";
import { ID_CARD_DEFAULT_POLICY } from "@/lib/org-policy";

export const QR_BASE = "https://workes.ecomedic.me/qr/rer";

export function qrUrlFor(memberNo: string | null | undefined) {
  return `${QR_BASE}?id=${encodeURIComponent(memberNo ?? "")}`;
}

export async function qrDataUrl(memberNo: string | null | undefined) {
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, qrUrlFor(memberNo), {
    margin: 1,
    width: 420,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#ffffff" },
  });
  const context = canvas.getContext("2d");
  if (!context) return canvas.toDataURL("image/png");
  const logo = new Image();
  logo.src = logoSrc;
  await new Promise<void>((resolve) => {
    logo.onload = () => resolve();
    logo.onerror = () => resolve();
  });
  if (logo.naturalWidth > 0) {
    const size = canvas.width * 0.22;
    const x = (canvas.width - size) / 2;
    const y = (canvas.height - size) / 2;
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(canvas.width / 2, canvas.height / 2, size * 0.56, 0, Math.PI * 2);
    context.fill();
    context.drawImage(logo, x, y, size, size);
  }
  return canvas.toDataURL("image/png");
}

export async function toDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const GREEN = [20, 83, 45] as const;

type CardData = {
  profile: Record<string, any> | null;
  email: string;
  positionName: string;
  memberNo: string | null;
  qr: string;
  avatar?: string | null;
  policy?: string;
};

function wrap(doc: jsPDF, text: string, width: number) {
  return doc.splitTextToSize(text, width) as string[];
}

function downloadBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Fill the uploaded three-page registration form without changing its artwork. */
export async function downloadFormPdf({ profile, email, positionName, memberNo, qr, policy }: CardData) {
  const p = profile ?? {};
  const response = await fetch(formTemplate.url);
  if (!response.ok) throw new Error("The registration form template could not be loaded.");
  const pdf = await PDFDocument.load(await response.arrayBuffer());
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const qrImage = await pdf.embedPng(qr);
  const pages = pdf.getPages();
  const ink = rgb(0.08, 0.12, 0.1);

  const write = (pageIndex: number, value: unknown, x: number, top: number, maxWidth: number, size = 9) => {
    const page = pages[pageIndex];
    if (!page) return;
    let text = value === null || value === undefined || value === "" ? "—" : String(value);
    while (text.length > 1 && font.widthOfTextAtSize(text, size) > maxWidth) text = text.slice(0, -1);
    page.drawText(text, { x, y: page.getHeight() - top, size, font, color: ink });
  };

  const page1 = pages[0];
  if (!page1) throw new Error("The registration form template has no first page.");
  write(0, memberNo, 90, 155, 180, 9);
  write(0, positionName, 72, 177, 200, 9);
  page1.drawRectangle({ x: 472, y: page1.getHeight() - 220, width: 88, height: 90, color: rgb(1, 1, 1) });
  page1.drawImage(qrImage, { x: 480, y: page1.getHeight() - 213, width: 74, height: 74 });

  write(0, p.first_name, 107, 356, 170); write(0, p.last_name, 354, 356, 164);
  write(0, p.middle_name, 116, 393, 166); write(0, p.username, 354, 393, 164);
  write(0, p.date_of_birth, 113, 427, 170); write(0, p.phone, 354, 427, 164);
  write(0, email, 119, 458, 169, 8); write(0, p.gender, 348, 458, 170);
  write(0, p.country, 98, 588, 168); write(0, p.state, 339, 588, 169);
  write(0, p.city, 80, 637, 169); write(0, p.home_number, 351, 637, 167);
  write(0, p.home_email, 146, 677, 370, 8);
  write(0, p.address_line1, 122, 708, 394, 8); write(0, p.address_line2, 122, 732, 394, 8); write(0, p.address_line3, 122, 756, 394, 8);

  write(1, p.institution, 145, 121, 370, 9);
  write(1, p.program_of_study, 116, 155, 166, 8); write(1, p.course_of_study, 344, 155, 169, 8);
  write(1, p.is_graduate ? "Graduate" : p.school_level, 120, 187, 166, 8);
  write(1, p.is_graduate ? p.graduation_year : "Not graduated", 453, 187, 59, 8);
  write(1, p.guardian_name, 102, 351, 414); write(1, p.guardian_phone, 113, 373, 403);
  write(1, p.guardian_address, 106, 395, 410, 8); write(1, p.guardian_relationship, 131, 418, 385);
  write(1, p.emergency_name, 104, 539, 412); write(1, p.emergency_phone, 113, 562, 403);
  write(1, p.emergency_relationship, 131, 585, 385);

  const page3 = pages[2];
  if (page3) {
    page3.drawRectangle({ x: 92, y: 118, width: 412, height: 420, color: rgb(1, 1, 1), opacity: 0.88 });
    page3.drawText("ORGANIZATIONAL POLICY", { x: 188, y: 510, size: 15, font: bold, color: rgb(0.25, 0.48, 0.17) });
    const words = (policy?.trim() || "No organizational policy has been published yet.").replace(/\s+/g, " ").split(" ");
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, 10) > 360) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
    lines.slice(0, 28).forEach((text, index) => page3.drawText(text, { x: 118, y: 480 - index * 15, size: 10, font, color: ink }));
  }

  downloadBytes(await pdf.save(), `ecomedic-form-${memberNo ?? "member"}.pdf`);
}

/** Two-sided CR80 ID card PDF: each page is exactly 85.60 × 53.98 mm. */
export async function downloadIdCardPdf({ profile, positionName, memberNo, qr, avatar, policy }: CardData) {
  const p = profile ?? {};
  const W = 85.6;
  const H = 53.98;
  const doc = new jsPDF({ unit: "mm", format: [W, H], orientation: "landscape" });
  const fullName = p.id_full_name || [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ");
  const [front, back] = await Promise.all([toDataUrl(frontTemplate), toDataUrl(backTemplate)]);

  // Front
  if (front) doc.addImage(front, "PNG", 0, 0, W, H);

  if (avatar) {
    try { doc.addImage(avatar, "JPEG", 60.1, 4.5, 20.7, 25.5); } catch { /* leave template photo */ }
  }
  doc.setDrawColor(91, 165, 58); doc.setLineWidth(0.5); doc.roundedRect(60.1, 4.5, 20.7, 25.5, 1, 1, "S");

  const details: Array<[string, string]> = [
    ["NAME:", fullName || "—"],
    ["POSITION:", positionName || "—"],
    ["BLOOD GROUP:", p.blood_group || "—"],
    ["PHONE NO:", p.id_phone || p.phone || "—"],
  ];
  let y = 22.4;
  details.forEach(([, value]) => {
    doc.setTextColor(8, 15, 13); doc.setFont("helvetica", "normal"); doc.setFontSize(5.8); doc.text(String(value).slice(0, 30), 26.4, y);
    y += 4.65;
  });
  doc.setFont("helvetica", "normal"); doc.setFontSize(5.2); doc.text(String(memberNo || "—").slice(0, 17), 68.2, 35.8);
  doc.addImage(qr, "PNG", 5.0, 39.0, 11.2, 11.2);
  doc.setTextColor(8, 15, 13); doc.setFont("helvetica", "bold"); doc.setFontSize(4.8);
  doc.text("SCAN FOR", 18.1, 43.6); doc.text("VERIFICATION", 18.1, 47.3);
  if (p.signature_data) {
    try { doc.addImage(String(p.signature_data), "PNG", 49.3, 40.2, 27, 5.8); } catch { /* use name below */ }
  } else {
    doc.setFont("times", "italic"); doc.setFontSize(8); doc.text(String(fullName || "Signature").slice(0, 28), 62.8, 44.3, { align: "center" });
  }

  // Back
  doc.addPage([W, H], "landscape");
  if (back) doc.addImage(back, "PNG", 0, 0, W, H);
  if (policy?.trim() && policy.trim() !== ID_CARD_DEFAULT_POLICY) {
    doc.setFillColor(3, 87, 43); doc.rect(5, 25, 76, 17.5, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "normal"); doc.setFontSize(4.35);
    const lines = wrap(doc, policy.replace(/\s+/g, " "), 72).slice(0, 7);
    lines.forEach((line, index) => doc.text(line, W / 2, 27 + index * 2.2, { align: "center" }));
  }
  const issued = p.registered_at ? new Date(p.registered_at).toLocaleDateString(undefined, { month: "2-digit", year: "numeric" }) : "—";
  doc.setTextColor(8, 15, 13); doc.setFont("helvetica", "normal"); doc.setFontSize(4.2); doc.text(issued, 43.3, 41.7);

  doc.save(`ecomedic-id-card-${memberNo ?? "member"}.pdf`);
}

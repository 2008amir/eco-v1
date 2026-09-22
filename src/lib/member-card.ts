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

/** Remove white/transparent margins so only the handwritten signature is rendered. */
export async function signatureInkDataUrl(source: string | null | undefined): Promise<string | null> {
  if (!source) return null;
  return await new Promise<string | null>((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) { resolve(source); return; }
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      let left = canvas.width;
      let top = canvas.height;
      let right = -1;
      let bottom = -1;
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const index = (y * canvas.width + x) * 4;
          const alpha = pixels.data[index + 3] ?? 0;
          const red = pixels.data[index] ?? 255;
          const green = pixels.data[index + 1] ?? 255;
          const blue = pixels.data[index + 2] ?? 255;
          if (alpha < 16 || (red > 242 && green > 242 && blue > 242)) {
            pixels.data[index + 3] = 0;
            continue;
          }
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
      }
      if (right < left || bottom < top) { resolve(null); return; }
      context.putImageData(pixels, 0, 0);
      const padding = 3;
      const cropLeft = Math.max(0, left - padding);
      const cropTop = Math.max(0, top - padding);
      const cropWidth = Math.min(canvas.width - cropLeft, right - left + 1 + padding * 2);
      const cropHeight = Math.min(canvas.height - cropTop, bottom - top + 1 + padding * 2);
      const cropped = document.createElement("canvas");
      cropped.width = cropWidth;
      cropped.height = cropHeight;
      cropped.getContext("2d")?.drawImage(canvas, cropLeft, cropTop, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      resolve(cropped.toDataURL("image/png"));
    };
    image.onerror = () => resolve(source);
    image.src = source;
  });
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

/** Load the uploaded template, retrying a few times so a flaky first request never blocks the download. */
async function fetchTemplateBytes(): Promise<ArrayBuffer> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(formTemplate.url, { cache: attempt === 0 ? "default" : "reload" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 0) return bytes;
      throw new Error("empty template");
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
    }
  }
  throw new Error(`The registration form could not be loaded. Please check your connection and try again. (${String((lastError as Error)?.message ?? lastError)})`);
}

/** Fill the uploaded three-page registration form without changing its artwork. */
export async function downloadFormPdf(data: CardData) {
  downloadBytes(await buildFormPdfBytes(data), `ecomedic-form-${data.memberNo ?? "member"}.pdf`);
}

/** Same filled form as {@link downloadFormPdf}, returned as bytes for preview/printing. */
export async function buildFormPdfBytes({ profile, email, positionName, memberNo, qr, policy }: CardData) {
  const p = profile ?? {};
  const templateBytes = await fetchTemplateBytes();
  const pdf = await PDFDocument.load(templateBytes);
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
  page1.drawImage(qrImage, { x: 483, y: page1.getHeight() - 211, width: 70, height: 70 });

  write(0, p.first_name, 107, 354, 170); write(0, p.last_name, 354, 354, 164);
  write(0, p.middle_name, 116, 390, 166); write(0, p.username, 354, 391, 164);
  write(0, p.date_of_birth, 113, 424, 170); write(0, p.phone, 354, 424, 164);
  write(0, email, 121, 455, 167, 8); write(0, p.gender, 348, 455, 170);
  write(0, p.country, 98, 587, 168); write(0, p.state, 339, 587, 169);
  write(0, p.city, 80, 635, 169); write(0, p.home_number, 351, 635, 167);
  write(0, p.home_email, 152, 676, 364, 8);
  write(0, p.address_line1, 122, 706, 394, 8); write(0, p.address_line2, 122, 729, 394, 8); write(0, p.address_line3, 122, 751, 394, 8);

  write(1, p.institution, 145, 119, 370, 9);
  write(1, p.program_of_study, 117, 153, 166, 8); write(1, p.course_of_study, 349, 153, 164, 8);
  write(1, p.is_graduate ? "Graduate" : p.school_level, 120, 183, 166, 8);
  write(1, p.is_graduate ? p.graduation_year : "Not graduated", 454, 183, 59, 8);
  write(1, p.guardian_name, 104, 350, 412); write(1, p.guardian_phone, 122, 372, 394);
  write(1, p.guardian_address, 118, 395, 398, 8); write(1, p.guardian_relationship, 132, 417, 384);
  write(1, p.emergency_name, 106, 538, 410); write(1, p.emergency_phone, 122, 561, 394);
  write(1, p.emergency_relationship, 134, 583, 382);

  const page3 = pages[2];
  if (page3) {
    const pageW = page3.getWidth();
    const pageH = page3.getHeight();
    const margin = 72; // 1 inch on each side
    const textWidth = pageW - margin * 2;
    const startY = pageH - 90 - margin; // 1 inch below the printed header
    const leading = 15;
    // Cover the "Write the policy here" placeholder.
    page3.drawRectangle({ x: margin - 4, y: pageH - 402, width: textWidth + 8, height: 24, color: rgb(1, 1, 1) });
    const words = (policy?.trim() || "No organizational policy has been published yet.").replace(/\s+/g, " ").split(" ");
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, 10) > textWidth) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
    const maxLines = Math.floor((startY - margin) / leading);
    lines.slice(0, maxLines).forEach((text, index) => page3.drawText(text, { x: margin, y: startY - index * leading, size: 10, font, color: ink }));
  }

  return pdf.save();
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
    try { doc.addImage(avatar, "JPEG", 60.9, 4.78, 21.25, 26.04); } catch { /* leave template photo */ }
  }

  const details: Array<[string, number, number]> = [
    [fullName || "—", 13.9, 21.4],
    [positionName || "—", 19.1, 26.0],
    [p.blood_group || "—", 25.2, 30.9],
    [p.id_phone || p.phone || "—", 19.8, 35.5],
  ];
  details.forEach(([value, x, y]) => {
    doc.setTextColor(8, 15, 13); doc.setFont("helvetica", "bold"); doc.setFontSize(8.7); doc.text(String(value).slice(0, 30), x, y, { maxWidth: 40 });
  });
  doc.setFont("helvetica", "bold"); doc.setFontSize(6.3); doc.text(String(memberNo || "—").slice(0, 14), 68.1, 35.5, { maxWidth: 16.2 });
  doc.addImage(qr, "PNG", 5.0, 39.0, 11.2, 11.2);
  doc.setTextColor(8, 15, 13); doc.setFont("helvetica", "bold"); doc.setFontSize(4.8);
  doc.text("SCAN FOR", 18.1, 43.6); doc.text("VERIFICATION", 18.1, 47.3);
  const signature = await signatureInkDataUrl(p.signature_data ? String(p.signature_data) : null);
  if (signature) {
    try { doc.addImage(signature, "PNG", 49.2, 39.1, 32.5, 9.1); } catch { /* use name below */ }
  } else {
    doc.setFont("times", "italic"); doc.setFontSize(8); doc.text(String(fullName || "Signature").slice(0, 28), 65.5, 47.5, { align: "center" });
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
  const issued = p.registered_at ? new Date(p.registered_at).toLocaleDateString("en-GB") : "—";
  doc.setTextColor(8, 15, 13); doc.setFont("helvetica", "bold"); doc.setFontSize(5.2); doc.text(issued, 49, 41.7, { align: "center", maxWidth: 12 });

  doc.save(`ecomedic-id-card-${memberNo ?? "member"}.pdf`);
}

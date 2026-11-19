import formTemplate from "@/assets/personal-information-form.pdf.asset.json";

/**
 * The blank registration form. The copy in public/ is served by every host
 * (including Vercel); the Lovable asset URL only works on Lovable hosting.
 */
export const FORM_TEMPLATE_URL = "/forms/personal-information-form.pdf";
export const FORM_TEMPLATE_URLS = [FORM_TEMPLATE_URL, formTemplate.url];

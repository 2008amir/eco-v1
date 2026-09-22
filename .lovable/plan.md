# Finalize verified-member access and official PDF form

## Changes
- Treat a member with a verified registration payment, registration date, and assigned EMS ID as fully registered, even if an older progress value was not advanced correctly.
- Redirect fully registered members away from the registration form to the main application so the welcome/application form never appears again.
- Use the uploaded three-page `Personal_Impormation.pdf` as the unchanged background for both the form preview and downloaded form.
- Reposition every saved value directly after its printed label and on its corresponding line, including form number, member type, QR code, personal details, address, education, guardian, and emergency contact.
- Keep the generated form number identical to the member’s EMS ID number.
- Fill the third page’s policy area while preserving the uploaded page artwork.
- Keep the existing two-sided member ID card download available beside the completed form download.

## Verification
- Render all three filled PDF pages as images and inspect every value for clipping, overlap, and correct line alignment.
- Verify a completed, payment-verified member is sent to the main application when opening the registration page.
- Check the ID card and form download controls on phone and desktop layouts.

## Technical details
- Derive PDF coordinates from the uploaded A4 pages (595.32 × 841.92 points), using each printed label and underline as the anchor.
- Use registration evidence (`registered_at` plus `member_no`) as the durable completion condition alongside the normal progress value.

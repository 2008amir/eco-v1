# Precisely align the member ID card

## Changes
- Position each member value directly beside its printed label using the template’s actual proportions.
- Fit the passport photo exactly inside the printed photo box without spilling or leaving an added border.
- Place the ID number in its printed field and the issue date inside the white issue-date box.
- Crop transparent space around captured signatures and place only the ink above the printed signature line.
- Apply the same coordinates to the on-screen card and downloaded PDF so both match.

## Verification
- Check front and back cards at desktop and phone sizes.
- Download a sample PDF and confirm the photo, text, signature, and issue date match the template artwork.

## Technical details
- Use percentage coordinates derived from the 1264 × 848 card templates.
- Preserve transparent PNG signature pixels and calculate an ink-only bounding box before rendering.

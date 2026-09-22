# One-time registration access

## Goal
Require every non-admin member to complete registration once, while ensuring the registration form never appears again after the registration payment is successfully verified.

## Changes
- Keep new and incomplete users in the registration flow.
- Treat the registration as permanently complete only when the stored completion step and verified registration records agree.
- Redirect completed members away from the registration page on later visits and sign-ins.
- Preserve the existing admin exemption.
- Verify the signed-in navigation behavior and current build.

## Technical details
Use the persisted onboarding completion state together with the verified registration date and unique member number; do not infer completion from payment submission or partial form data.

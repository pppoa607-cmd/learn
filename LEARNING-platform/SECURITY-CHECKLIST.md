# Security checklist before real student data

- [ ] Firebase Authentication Google provider enabled.
- [ ] Verify admin custom claims are set only through trusted Admin SDK.
- [ ] Remove/disable `bootstrapAdministrator` after the two admins are provisioned.
- [ ] Replace course-file Storage read rule with actual enrollment/role checks.
- [ ] Test Firestore and Storage rules with Emulator Suite as unauthenticated, student, and admin users.
- [ ] Wire frontend student registration to `ensureStudentProfile`; never let frontend assign roles or codes.
- [ ] Add Cloud Function invocation from admin UI for payment review.
- [ ] Confirm payments only after independently verifying transaction.
- [ ] Keep exam answer keys and grades in admin-only collections.
- [ ] Implement server-side exam submission and grading.
- [ ] Implement attendance server-side and audit admin edits.
- [ ] Add enrollment checks before exposing course files.
- [ ] Add tests for student privilege escalation, cross-student reads, grades, receipts, and payment status.
- [ ] Configure App Check and budget alerts.
- [ ] Do not store Vodafone Cash PINs or credentials.

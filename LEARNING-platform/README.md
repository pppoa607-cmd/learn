# LEARNING — starter full-stack educational platform

This is a deployable starter project, not a live hosted site. It includes a responsive Arabic RTL React UI, Firebase client setup, Firestore/Storage rules, and initial Cloud Functions.

## Important status

- Google sign-in UI and Firebase client wiring: implemented, requires your Firebase web config.
- Student/admin dashboard shell: implemented.
- Course upload and payment request UI: implemented, requires Storage/Firestore rules and Firebase configuration.
- Unique student code: backend callable `ensureStudentProfile` is implemented, but the frontend must be wired to call it after login before treating code generation as active.
- Admin provisioning: `bootstrapAdministrator` callable is included. Deploy it, sign in as one of the allowlisted verified accounts, invoke it from a trusted admin setup screen or Firebase callable test, then sign out/in. **Disable or remove the bootstrap function after provisioning both administrators.**
- Attendance and examination UI: placeholder only; production backend and forms are not yet implemented.
- Vodafone Cash: not integrated. Payment requests are manual review only.
- The Storage rule currently allows signed-in users to read course files. Replace this with course-enrollment checks before using private/restricted materials.
- Admin payment confirmation callable is implemented but the current UI does not invoke it yet.
- Before using with real students, complete the items in `SECURITY-CHECKLIST.md` and test with Firebase Emulator Suite.

## Requirements

- Node.js 20+
- Firebase project
- Firebase CLI (`npm install -g firebase-tools`)
- For Cloud Functions deployment, the Firebase project may require the Blaze billing plan.

## Configure

1. Create a Firebase project at https://console.firebase.google.com/
2. Add a Web App and copy the Firebase web config.
3. Copy `.env.example` to `.env.local`, then fill in the values from Firebase Console.
4. Enable Authentication → Sign-in method → Google.
5. Create Firestore Database and enable Storage if available for your project.
6. Copy `.firebaserc.example` to `.firebaserc` and replace `YOUR_FIREBASE_PROJECT_ID`.
7. Run `npm install`.
8. Run `cd functions && npm install && npm run build && cd ..`.
9. Run `npm run dev` to preview locally.

## Deploy

From the project root:
```bash
npm install
cd functions && npm install && npm run build && cd ..
npm run build
firebase login
firebase use YOUR_FIREBASE_PROJECT_ID
firebase deploy
```
Firebase Hosting normally serves the deployed site at `https://YOUR_PROJECT_ID.web.app` or `https://YOUR_PROJECT_ID.firebaseapp.com`. The actual URL appears after deployment.

## Critical admin setup notes

The allowlisted administrator emails are:
- ozilziad24@gmail.com — زياد الطنساوي
- zt067313@gmail.com — ندى الطنساوي

The backend bootstrap callable only accepts those exact verified email addresses. After deploying functions:
1. Sign in to the app with each admin account once.
2. Invoke `bootstrapAdministrator` for that authenticated user through a temporary setup-only button or a trusted callable test.
3. Sign out and sign in again to refresh custom claims.
4. Verify the admin claim and `/administrators/{uid}` record.
5. Remove/disable `bootstrapAdministrator` after both administrators are provisioned.

Do not make the admin setup function available indefinitely. Do not share Firebase service-account keys or account passwords.

## Rules

`firestore.rules` denies access by default and protects grades, payment confirmation, tuition accounts, and admin records. Review and test rules in Firebase Emulator Suite before production. Firebase Admin SDK operations bypass Firestore rules, so validate every privileged Cloud Function carefully.

## Remaining production work

- Wire `ensureStudentProfile` into login lifecycle and test collision-safe student code creation.
- Add administrator UI to invoke `confirmPaymentRequest` callable.
- Implement exam creation, secure attempt submission, server-side grading, and private grade reports.
- Implement attendance records and live/recorded lesson tracking.
- Add course enrollment/access control and private Storage download handling.
- Calculate remaining tuition from a trusted tuition total and confirmed payments; do not rely on client input.
- Add rate limiting/abuse protections, audit review, and automated authorization tests.
- Configure App Check and monitoring.

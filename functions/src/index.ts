import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";

initializeApp();
const db = getFirestore();
const ADMIN_EMAILS = new Map<string, string>([
  ["ozilziad24@gmail.com", "زياد الطنساوي"],
  ["zt067313@gmail.com", "ندى الطنساوي"]
]);

function requireAdmin(request: any) {
  if (!request.auth || request.auth.token.admin !== true) {
    throw new HttpsError("permission-denied", "Administrator access required.");
  }
}

// One-time-ish bootstrap: only the two exact allowlisted, verified accounts may
// self-provision. Protect further by deploying only to your private project,
// and remove/disable this function after both admins are initialized.
export const bootstrapAdministrator = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const uid = request.auth.uid;
  const user = await getAuth().getUser(uid);
  const email = (user.email || "").toLowerCase();
  const displayName = ADMIN_EMAILS.get(email);
  if (!displayName || user.emailVerified !== true) {
    throw new HttpsError("permission-denied", "This account is not eligible for administrator setup.");
  }
  await getAuth().setCustomUserClaims(uid, { ...(user.customClaims || {}), admin: true });
  await db.doc(`administrators/${uid}`).set({
    uid, email, displayName, provisionedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  await db.doc(`users/${uid}`).set({
    uid, email, displayName, role: "admin", status: "active",
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { success: true, message: "Administrator role provisioned. Sign out and sign in again." };
});

export const ensureStudentProfile = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const uid = request.auth.uid;
  const user = await getAuth().getUser(uid);
  const email = (user.email || "").toLowerCase();
  if (ADMIN_EMAILS.has(email) && user.customClaims?.admin === true) {
    return { role: "admin" };
  }
  const userRef = db.doc(`users/${uid}`);
  const existing = await userRef.get();
  if (existing.exists) return { role: existing.get("role") === "admin" ? "admin" : "student", studentCode: existing.get("studentCode") || null };

  const counterRef = db.doc("systemCounters/studentCodes");
  const result = await db.runTransaction(async tx => {
    const snap = await tx.get(counterRef);
    const next = (snap.exists ? Number(snap.get("next") || 1) : 1);
    const code = `LRN-${new Date().getFullYear()}-${String(next).padStart(6, "0")}`;
    tx.set(counterRef, { next: next + 1 }, { merge: true });
    tx.create(db.doc(`studentCodes/${code}`), { uid, createdAt: FieldValue.serverTimestamp() });
    tx.set(userRef, {
      uid, email, displayName: user.displayName || "طالب جديد", role: "student",
      status: "active", studentCode: code, createdAt: FieldValue.serverTimestamp()
    });
    return code;
  });
  return { role: "student", studentCode: result };
});

export const confirmPaymentRequest = onCall(async (request) => {
  requireAdmin(request);
  const { paymentRequestId, status } = request.data || {};
  if (typeof paymentRequestId !== "string" || !["confirmed", "rejected"].includes(status)) {
    throw new HttpsError("invalid-argument", "Invalid payment request.");
  }
  const paymentRef = db.doc(`paymentRequests/${paymentRequestId}`);
  await db.runTransaction(async tx => {
    const snap = await tx.get(paymentRef);
    if (!snap.exists) throw new HttpsError("not-found", "Payment request not found.");
    if (snap.get("status") !== "pending") throw new HttpsError("failed-precondition", "Payment request has already been processed.");
    tx.update(paymentRef, {
      status, reviewedBy: request.auth!.uid, reviewedAt: FieldValue.serverTimestamp()
    });
    if (status === "confirmed") {
      const studentUid = snap.get("studentUid");
      const amountPiasters = snap.get("amountPiasters");
      const txRef = db.collection("paymentTransactions").doc();
      tx.create(txRef, {
        studentUid, amountPiasters, sourceRequestId: paymentRequestId,
        status: "confirmed", confirmedBy: request.auth!.uid,
        createdAt: FieldValue.serverTimestamp()
      });
      const accountRef = db.doc(`tuitionAccounts/${studentUid}`);
      const account = await tx.get(accountRef);
      tx.set(accountRef, {
        studentUid,
        totalPaidPiasters: Number(account.get("totalPaidPiasters") || 0) + amountPiasters,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
    const logRef = db.collection("auditLogs").doc();
    tx.create(logRef, {
      actorUid: request.auth!.uid, action: `payment_${status}`,
      targetId: paymentRequestId, createdAt: FieldValue.serverTimestamp()
    });
  });
  return { success: true };
});

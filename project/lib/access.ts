// Login tracking + admin approval, backed by Firestore.
//
// userAccess/{email}  — one doc per Google account:
//   { email, displayName, uid, loginCount, firstSeenAt, lastSeenAt,
//     approved, approvedBy, approvedAt }
// loginEvents/{auto}  — append-only log of every session sign-in.

import { firebase, getFirebaseApp } from '@/lib/firebase/client';
import type firebaseType from 'firebase/compat/app';

export interface UserAccessDoc {
  email: string;
  displayName: string;
  uid: string;
  loginCount: number;
  firstSeenAt?: firebaseType.firestore.Timestamp;
  lastSeenAt?: firebaseType.firestore.Timestamp;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: firebaseType.firestore.Timestamp;
}

export interface LoginEventDoc {
  id: string;
  email: string;
  uid: string;
  at?: firebaseType.firestore.Timestamp;
  userAgent: string;
}

async function getDb() {
  await import('firebase/compat/firestore');
  return (await getFirebaseApp()).firestore();
}

const docIdFor = (email: string) => email.trim().toLowerCase();

// Upsert the user's access doc and append a login event. Call once per session.
export async function recordLogin(user: firebaseType.User): Promise<void> {
  const db = await getDb();
  const email = docIdFor(user.email ?? '');
  if (!email) return;
  const ref = db.collection('userAccess').doc(email);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      tx.update(ref, {
        uid: user.uid,
        displayName: user.displayName ?? '',
        lastSeenAt: firebase.firestore.FieldValue.serverTimestamp(),
        loginCount: firebase.firestore.FieldValue.increment(1),
      });
    } else {
      tx.set(ref, {
        email,
        displayName: user.displayName ?? '',
        uid: user.uid,
        approved: false,
        loginCount: 1,
        firstSeenAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastSeenAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

  await db.collection('loginEvents').add({
    email,
    uid: user.uid,
    at: firebase.firestore.FieldValue.serverTimestamp(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  });
}

export function subscribeToAccess(
  email: string,
  onChange: (doc: UserAccessDoc | null) => void,
  onError?: (err: Error) => void,
): () => void {
  let unsub: () => void = () => undefined;
  void getDb().then((db) => {
    unsub = db
      .collection('userAccess')
      .doc(docIdFor(email))
      .onSnapshot((snap) => onChange(snap.exists ? (snap.data() as UserAccessDoc) : null), onError);
  });
  return () => unsub();
}

export function subscribeUserAccessList(
  onChange: (docs: UserAccessDoc[]) => void,
  onError?: (err: Error) => void,
): () => void {
  let unsub: () => void = () => undefined;
  void getDb().then((db) => {
    unsub = db
      .collection('userAccess')
      .orderBy('lastSeenAt', 'desc')
      .onSnapshot(
        (snap) => onChange(snap.docs.map((d) => d.data() as UserAccessDoc)),
        onError,
      );
  });
  return () => unsub();
}

export function subscribeLoginEvents(
  limit: number,
  onChange: (docs: LoginEventDoc[]) => void,
  onError?: (err: Error) => void,
): () => void {
  let unsub: () => void = () => undefined;
  void getDb().then((db) => {
    unsub = db
      .collection('loginEvents')
      .orderBy('at', 'desc')
      .limit(limit)
      .onSnapshot(
        (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LoginEventDoc, 'id'>) }))),
        onError,
      );
  });
  return () => unsub();
}

export async function setUserApproval(email: string, approved: boolean, adminEmail: string): Promise<void> {
  const db = await getDb();
  await db
    .collection('userAccess')
    .doc(docIdFor(email))
    .set(
      {
        approved,
        approvedBy: approved ? adminEmail : firebase.firestore.FieldValue.delete(),
        approvedAt: approved ? firebase.firestore.FieldValue.serverTimestamp() : firebase.firestore.FieldValue.delete(),
      },
      { merge: true },
    );
}

// Reads/clears visitor & traffic analytics in Firestore.
// Uses the REST-based client (js/firestore-rest.js) instead of the
// Firestore SDK for these calls.
import { restListCollection, restDeleteDocs, restSetDocs, restGetDoc } from "./firestore-rest.js";

// Fetches every analytics_hits document, sorted oldest -> newest (same
// shape/order the admin dashboard already expects).
export async function fetchAnalyticsHits() {
  const docs = await restListCollection("analytics_hits");
  const hits = docs.map((d) => d.data);
  hits.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  return hits;
}

// Deletes every analytics_hits document (the dashboard's "clear all"
// action).
export async function clearAnalyticsHits() {
  const docs = await restListCollection("analytics_hits");
  await restDeleteDocs(
    docs.map((d) => ({ collection: "analytics_hits", id: d.id })),
  );
}

// Fetches every channel_hits document (one per "user pressed play on a
// channel" event) — powers the Most-Watched Channels report.
export async function fetchChannelHits() {
  const docs = await restListCollection("channel_hits");
  const hits = docs.map((d) => d.data);
  hits.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  return hits;
}

// Deletes every channel_hits document (the dashboard's "clear all" action
// for the Most-Watched Channels report).
export async function clearChannelHits() {
  const docs = await restListCollection("channel_hits");
  await restDeleteDocs(
    docs.map((d) => ({ collection: "channel_hits", id: d.id })),
  );
}

// ---- Admin roster / roles (owner, editor, viewer) ----

// Fetches every row in admin_roles -> [{ uid, email, role, addedAt, addedBy }, ...]
export async function fetchAdminRoles() {
  const docs = await restListCollection("admin_roles");
  return docs.map((d) => ({ uid: d.id, ...d.data }));
}

// Fetches a single admin's role row, or null if they don't have one yet.
export async function fetchAdminRole(uid) {
  const data = await restGetDoc("admin_roles", uid);
  return data ? { uid, ...data } : null;
}

// Creates/overwrites one admin's role row.
export async function setAdminRole(uid, data) {
  await restSetDocs([{ collection: "admin_roles", id: uid, data }]);
}

// Claims the very first Owner slot: writes the admin's admin_roles row
// and the admin_meta/bootstrap marker in a single commit, so
// firestore.rules can enforce that this can only ever happen once.
export async function bootstrapFirstOwner(uid, roleData) {
  await restSetDocs([
    { collection: "admin_roles", id: uid, data: roleData },
    {
      collection: "admin_meta",
      id: "bootstrap",
      data: { ownerUid: uid, createdAt: new Date().toISOString() },
    },
  ]);
}

// Removes an admin's role row (revokes their organizational role label;
// does NOT delete their Firebase Auth account — that must still be done
// from the Firebase Console).
export async function removeAdminRole(uid) {
  await restDeleteDocs([{ collection: "admin_roles", id: uid }]);
}

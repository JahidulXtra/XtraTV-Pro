// Records an immutable audit trail of admin dashboard actions — who did
// what, and when — to the "admin_audit_log" Firestore collection.
// Pairs with the multi-admin/role system (js/analytics-web.js's
// admin_roles helpers): every logged entry captures the acting admin's
// uid/email and their role *at the time of the action*.
//
// This is intentionally append-only from the client: there is no
// update/delete export here, and firestore.rules blocks update/delete on
// this collection entirely, so the log can't be edited or wiped by an
// admin (including an Owner) after the fact.
import { getCurrentAdminUser } from "./auth-web.js";
import { restSetDocs, restRunQuery } from "./firestore-rest.js";

const AUDIT_PAGE_SIZE = 10;

// Fire-and-forget-safe: logging must never break the admin action that
// triggered it, so this function swallows its own errors (and just warns
// to the console) rather than throwing.
export async function logAuditEvent(action, { targetLabel = "", details = "" } = {}) {
  try {
    const me = await getCurrentAdminUser();
    if (!me) return;

    let role = "";
    try {
      const { fetchAdminRole } = await import("./analytics-web.js");
      const row = await fetchAdminRole(me.uid);
      role = (row && row.role) || "";
    } catch {
      // Role lookup is best-effort context for the log entry — a failure
      // here shouldn't stop the entry itself from being written.
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await restSetDocs([
      {
        collection: "admin_audit_log",
        id,
        data: {
          id,
          timestamp: new Date().toISOString(),
          actorUid: me.uid,
          actorEmail: me.email || "",
          actorRole: role || "unknown",
          action,
          targetLabel,
          details,
        },
      },
    ]);
  } catch (err) {
    console.warn("Audit log write failed (action not blocked by this):", err);
  }
}

// Fetches one page of admin_audit_log entries, newest first, ordered by
// timestamp. Pass the previous page's `oldestTimestamp` as `before` to
// load the next (older) page, so opening the tab never has to pull the
// whole (potentially huge, ever-growing) collection at once.
// Returns { entries, hasMore, oldestTimestamp }.
export async function fetchAuditLogPage({ pageSize = AUDIT_PAGE_SIZE, before } = {}) {
  const docs = await restRunQuery("admin_audit_log", {
    orderByField: "timestamp",
    direction: "DESCENDING",
    limit: pageSize + 1, // fetch one extra to know if there's a next page
    startAfterValue: before,
  });
  const entries = docs.slice(0, pageSize).map((d) => d.data);
  return {
    entries,
    hasMore: docs.length > pageSize,
    oldestTimestamp: entries.length ? entries[entries.length - 1].timestamp : before ?? null,
  };
}

// Human-friendly labels for each action code, used by the dashboard UI.
export const AUDIT_ACTION_LABELS = {
  channel_add: "Added channel",
  channel_edit: "Edited channel",
  channel_delete: "Deleted channel",
  channel_delete_all: "Deleted ALL channels",
  channel_bulk_category_reassign: "Bulk category reassign",
  playlist_import: "Imported playlist / backup",
  role_create: "Admin role created",
  role_update: "Admin role changed",
  role_remove: "Admin role removed",
  admin_create: "New admin account created",
  clear_analytics_hits: "Cleared visitor analytics history",
  clear_channel_hits: "Cleared channel-view history",
};

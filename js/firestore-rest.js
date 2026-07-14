// Firestore REST API client — used for listing a collection, deleting
// documents, and creating/overwriting documents, all authenticated with
// the admin ID token from auth-web.js.
import { getAdminIdToken } from "./auth-web.js";

const PROJECT_ID = "xtra-tv-pro";
// Full URL — used to build the actual fetch() request endpoints.
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
// Relative resource path — this is what Firestore's commit API expects
// inside each Write's "name"/"delete" field (NOT the full https:// URL).
const RESOURCE_BASE = `projects/${PROJECT_ID}/databases/(default)/documents`;

async function authHeaders() {
  const token = await getAdminIdToken();
  if (!token) {
    throw new Error(
      "Not signed in as admin — no ID token available for Firestore REST call.",
    );
  }
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

// ---- JS value <-> Firestore REST "Value" conversion ----
// (Only needs to cover the plain shapes this app actually stores: strings,
// numbers, booleans, null, arrays, and nested plain objects.)
function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") {
    return Number.isInteger(v)
      ? { integerValue: String(v) }
      : { doubleValue: v };
  }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === "object") return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
}

function toFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj || {})) fields[k] = toValue(v);
  return fields;
}

function fromValue(v) {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return parseInt(v.integerValue, 10);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromValue);
  if ("mapValue" in v) return fromFields(v.mapValue.fields || {});
  return null;
}

function fromFields(fields) {
  const obj = {};
  for (const [k, v] of Object.entries(fields || {})) obj[k] = fromValue(v);
  return obj;
}

async function throwOnError(res, label) {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Firestore REST ${label} failed (${res.status}): ${body}`);
  }
}

// Runs a simple structured query: one collection, one orderBy field,
// a limit, and an optional "start after this value" cursor (for
// pagination without re-fetching everything already seen). Only
// supports the shapes this app actually needs (see fetchAuditLogPage
// in js/audit-log.js) — not a general-purpose query builder.
export async function restRunQuery(collection, { orderByField, direction = "DESCENDING", limit = 100, startAfterValue } = {}) {
  const headers = await authHeaders();
  const structuredQuery = {
    from: [{ collectionId: collection }],
    orderBy: [{ field: { fieldPath: orderByField }, direction }],
    limit,
  };
  if (startAfterValue !== undefined && startAfterValue !== null) {
    structuredQuery.startAt = { values: [toValue(startAfterValue)], before: false };
  }
  const res = await fetch(`${BASE}:runQuery`, {
    method: "POST",
    headers,
    body: JSON.stringify({ structuredQuery }),
  });
  await throwOnError(res, "runQuery");
  const rows = await res.json();
  const docs = (rows || [])
    .filter((row) => row.document)
    .map((row) => ({
      id: row.document.name.split("/").pop(),
      data: fromFields(row.document.fields),
    }));
  return docs;
}

// Fetches a single document. Returns null if it doesn't exist.
export async function restGetDoc(collection, id) {
  const headers = await authHeaders();
  const res = await fetch(`${BASE}/${collection}/${id}`, { headers });
  if (res.status === 404) return null;
  await throwOnError(res, "get");
  const data = await res.json();
  return fromFields(data.fields);
}

// Lists every document in a top-level collection, handling pagination.
// Returns [{ id, data }, ...].
export async function restListCollection(collection) {
  const headers = await authHeaders();
  const out = [];
  let pageToken = "";
  do {
    const url = `${BASE}/${collection}?pageSize=300${
      pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""
    }`;
    const res = await fetch(url, { headers });
    await throwOnError(res, "list");
    const data = await res.json();
    (data.documents || []).forEach((d) => {
      const id = d.name.split("/").pop();
      out.push({ id, data: fromFields(d.fields) });
    });
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return out;
}

// Creates/overwrites documents in one or more batched commits.
// docs: [{ collection, id, data }, ...]
export async function restSetDocs(docs) {
  if (!docs.length) return;
  const headers = await authHeaders();
  for (let i = 0; i < docs.length; i += 400) {
    const chunk = docs.slice(i, i + 400);
    const res = await fetch(`${BASE}:commit`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        writes: chunk.map((d) => ({
          update: {
            name: `${RESOURCE_BASE}/${d.collection}/${d.id}`,
            fields: toFields(d.data),
          },
        })),
      }),
    });
    await throwOnError(res, "commit(set)");
  }
}

// Deletes documents given their { collection, id } pairs, batched.
export async function restDeleteDocs(refs) {
  if (!refs.length) return;
  const headers = await authHeaders();
  for (let i = 0; i < refs.length; i += 400) {
    const chunk = refs.slice(i, i + 400);
    const res = await fetch(`${BASE}:commit`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        writes: chunk.map((r) => ({
          delete: `${RESOURCE_BASE}/${r.collection}/${r.id}`,
        })),
      }),
    });
    await throwOnError(res, "commit(delete)");
  }
}

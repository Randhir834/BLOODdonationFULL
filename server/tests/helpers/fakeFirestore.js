// A small in-memory stand-in for the parts of Firestore the services use, so the real service code
// (transactions, queries, running totals) can be tested without a database or network.
// It is sequential, so it does not model two requests racing each other.

const DELETE = Symbol("field-delete");

/** Stand-ins for firebase-admin's FieldValue. */
export const FieldValue = {
  increment: (n) => ({ __increment: n }),
  delete: () => DELETE,
};

const isPlain = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isIncrement = (value) => isPlain(value) && "__increment" in value;

// Writes `patch` into `target`. With `deep`, nested objects are merged (set with { merge: true }).
const apply = (target, patch, deep) => {
  for (const [key, value] of Object.entries(patch)) {
    if (value === DELETE) delete target[key];
    else if (isIncrement(value)) target[key] = (target[key] || 0) + value.__increment;
    else if (deep && isPlain(value)) {
      if (!isPlain(target[key])) target[key] = {};
      apply(target[key], value, true);
    } else target[key] = structuredClone(value);
  }
};

// `ref` mirrors the real SDK's QueryDocumentSnapshot.ref, which application code may read and pass
// on (e.g. to tx.get/tx.update), exactly like a snapshot read from a live Firestore query.
const snapshot = (ref, data, fields) => {
  const stored =
    data && (fields ? Object.fromEntries(fields.filter((f) => f in data).map((f) => [f, data[f]])) : data);
  return {
    id: ref.id,
    ref,
    exists: data !== undefined,
    data: () => (stored ? structuredClone(stored) : undefined),
    get: (field) => structuredClone(stored?.[field]),
  };
};

const matches = (doc, [field, op, value]) => {
  if (op === "==") return doc[field] === value;
  if (op === ">=") return doc[field] >= value;
  if (op === "in") return value.includes(doc[field]);
  throw new Error(`fakeFirestore: unsupported operator ${op}`);
};

class Query {
  constructor(db, name, clauses = {}) {
    this.db = db;
    this.name = name;
    this.clauses = { where: [], order: null, limit: null, select: null, ...clauses };
  }

  #next(patch) {
    return new Query(this.db, this.name, { ...this.clauses, ...patch });
  }

  where(field, op, value) {
    return this.#next({ where: [...this.clauses.where, [field, op, value]] });
  }
  orderBy(field, direction = "asc") {
    return this.#next({ order: [field, direction] });
  }
  limit(n) {
    return this.#next({ limit: n });
  }
  select(...fields) {
    return this.#next({ select: fields });
  }

  #rows() {
    const { where, order, limit } = this.clauses;
    let rows = [...this.db.collectionData(this.name)].filter(([, doc]) =>
      where.every((w) => matches(doc, w))
    );
    if (order) {
      const [field, direction] = order;
      rows.sort(([, a], [, b]) => (a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0));
      if (direction === "desc") rows.reverse();
    }
    if (limit) rows = rows.slice(0, limit);
    return rows;
  }

  async get() {
    const docs = this.#rows().map(([id, data]) =>
      snapshot(new DocRef(this.db, this.name, id), data, this.clauses.select)
    );
    return { docs, size: docs.length, empty: docs.length === 0 };
  }

  count() {
    return { get: async () => ({ data: () => ({ count: this.#rows().length }) }) };
  }
}

class DocRef {
  constructor(db, name, id) {
    this.db = db;
    this.name = name;
    this.id = id;
  }
  async get() {
    return snapshot(this, this.db.collectionData(this.name).get(this.id));
  }
  set(data, options = {}) {
    const rows = this.db.collectionData(this.name);
    if (options.merge) {
      const current = rows.get(this.id) ?? {};
      apply(current, data, true);
      rows.set(this.id, current);
    } else {
      const fresh = {};
      apply(fresh, data, false);
      rows.set(this.id, fresh);
    }
    return Promise.resolve();
  }
  update(patch) {
    const current = this.db.collectionData(this.name).get(this.id);
    if (!current) throw new Error(`fakeFirestore: no document to update (${this.name}/${this.id})`);
    apply(current, patch, false);
    return Promise.resolve();
  }
  delete() {
    this.db.collectionData(this.name).delete(this.id);
    return Promise.resolve();
  }
}

class Collection extends Query {
  doc(id = `auto${++this.db.counter}`) {
    return new DocRef(this.db, this.name, id);
  }
  async add(data) {
    const ref = this.doc();
    await ref.set(data);
    return ref;
  }
}

export class FakeFirestore {
  constructor() {
    this.reset();
  }

  reset() {
    this.collections = new Map();
    this.counter = 0;
  }

  collectionData(name) {
    if (!this.collections.has(name)) this.collections.set(name, new Map());
    return this.collections.get(name);
  }

  collection(name) {
    return new Collection(this, name);
  }

  /** Puts documents straight into a collection: seed("users", { u1: { role: "donar" } }). */
  seed(name, documents) {
    for (const [id, data] of Object.entries(documents))
      this.collectionData(name).set(id, structuredClone(data));
  }

  /** The raw stored document, or undefined. */
  read(name, id) {
    return this.collectionData(name).get(id);
  }

  getAll(...refs) {
    return Promise.all(refs.map((ref) => ref.get()));
  }

  /** A write batch: like a transaction but with no reads and no rollback on failure, same as the real one. */
  batch() {
    const ops = [];
    return {
      set: (ref, data, options) => ops.push(() => ref.set(data, options)),
      update: (ref, patch) => ops.push(() => ref.update(patch)),
      delete: (ref) => ops.push(() => ref.delete()),
      commit: async () => {
        for (const op of ops) await op();
      },
    };
  }

  // Like Firestore, a transaction that throws leaves nothing behind.
  async runTransaction(work) {
    const backup = new Map([...this.collections].map(([name, rows]) => [name, structuredClone(rows)]));
    const tx = {
      get: (target) => target.get(),
      set: (ref, data, options) => ref.set(data, options),
      update: (ref, patch) => ref.update(patch),
      delete: (ref) => ref.delete(),
    };
    try {
      return await work(tx);
    } catch (error) {
      this.collections = backup;
      throw error;
    }
  }
}

export const db = new FakeFirestore();

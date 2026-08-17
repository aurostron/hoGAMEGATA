import MiniSearch from "minisearch";

export interface SearchIndexRecord {
  i: string;           // id
  t: string;           // title
  s: string;           // slug
  c: string | null;    // coverUrl
  d: string[];         // developers
}

let miniSearchInstance: MiniSearch<SearchIndexRecord> | null = null;
let allRecordsMap = new Map<string, SearchIndexRecord>();

self.onmessage = (event: MessageEvent) => {
  const { type, payload, id } = event.data;

  if (type === "INIT_INDEX") {
    try {
      const records: SearchIndexRecord[] = payload;
      allRecordsMap.clear();

      const ms = new MiniSearch<SearchIndexRecord>({
        idField: "i",
        fields: ["t", "d"], // title & developers for quick suggestion search
        storeFields: ["i", "t", "s", "c", "d"],
        extractField: (document, fieldName) => {
          if (fieldName === "d") {
            return (document[fieldName] as string[])?.join(" ") || "";
          }
          return (document as any)[fieldName];
        },
        searchOptions: {
          fuzzy: 0.2,
          prefix: true,
          boost: { t: 10, d: 3 },
          combineWith: "AND",
        },
      });

      records.forEach(r => allRecordsMap.set(String(r.i), r));
      ms.addAll(records);
      miniSearchInstance = ms;

      self.postMessage({ id, type: "INIT_SUCCESS", count: records.length });
    } catch (err: any) {
      self.postMessage({ id, type: "INIT_ERROR", error: err.message });
    }
  } else if (type === "SEARCH") {
    try {
      const { query, limit = 20 } = payload;

      if (!query || !query.trim() || !miniSearchInstance) {
        self.postMessage({ id, type: "SEARCH_RESULTS", results: [], query });
        return;
      }

      const trimmed = query.trim();
      const searchResults = miniSearchInstance.search(trimmed, {
        fuzzy: (term) => (term.length > 3 ? 0.25 : null),
        prefix: true,
        boost: { t: 15, d: 5 },
        combineWith: "OR",
        weights: {
          fuzzy: 0.45,
          prefix: 0.65,
        },
      });

      const sliced = searchResults.slice(0, limit);
      const results = sliced.map(res => {
        const fullRecord = allRecordsMap.get(String(res.id)) || (res as unknown as SearchIndexRecord);
        return {
          id: String(fullRecord.i),
          title: fullRecord.t,
          slug: fullRecord.s,
          coverUrl: fullRecord.c,
          developerNames: Array.isArray(fullRecord.d) ? fullRecord.d.join(", ") : null,
          score: res.score,
        };
      });

      self.postMessage({ id, type: "SEARCH_RESULTS", results, query });
    } catch (err: any) {
      self.postMessage({ id, type: "SEARCH_ERROR", error: err.message, query });
    }
  }
};

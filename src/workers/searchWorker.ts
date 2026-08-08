import MiniSearch from "minisearch";

export interface SearchIndexRecord {
  i: number;           // id
  t: string;           // title
  s: string;           // slug
  c: string | null;    // coverUrl
  r: number | null;    // rating
  sr: number | null;   // steamRating
  sc: number | null;   // scareRating
  y: number | null;    // releaseYear
  d: string[];         // developers
  g: string[];         // genres
}

let miniSearchInstance: MiniSearch<SearchIndexRecord> | null = null;
let allRecordsMap = new Map<number, SearchIndexRecord>();

self.onmessage = (event: MessageEvent) => {
  const { type, payload, id } = event.data;

  if (type === "INIT_INDEX") {
    try {
      const records: SearchIndexRecord[] = payload;
      
      const ms = new MiniSearch<SearchIndexRecord>({
        idField: "i",
        fields: ["t", "d", "g"], // search in title, developers, genres
        storeFields: ["i", "t", "s", "c", "r", "sr", "sc", "y", "d", "g"],
        extractField: (document, fieldName) => {
          if (fieldName === "d" || fieldName === "g") {
            return (document[fieldName] as string[])?.join(" ") || "";
          }
          return (document as any)[fieldName];
        },
        searchOptions: {
          fuzzy: 0.2,
          prefix: true,
          boost: { t: 10, d: 3, g: 2 },
          combineWith: "AND",
        },
      });

      records.forEach(r => allRecordsMap.set(r.i, r));
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

      // Execute search with MiniSearch
      const searchResults = miniSearchInstance.search(query, {
        fuzzy: query.length > 3 ? 0.2 : false,
        prefix: true,
        boost: { t: 10, d: 3, g: 2 },
      });

      const sliced = searchResults.slice(0, limit);
      const results = sliced.map(res => {
        const fullRecord = allRecordsMap.get(res.id as number) || (res as unknown as SearchIndexRecord);
        return {
          id: fullRecord.i,
          title: fullRecord.t,
          slug: fullRecord.s,
          coverUrl: fullRecord.c,
          rating: fullRecord.r,
          steamRating: fullRecord.sr,
          scareRating: fullRecord.sc,
          releaseYear: fullRecord.y,
          developers: fullRecord.d,
          genres: fullRecord.g,
          score: res.score,
        };
      });

      self.postMessage({ id, type: "SEARCH_RESULTS", results, query });
    } catch (err: any) {
      self.postMessage({ id, type: "SEARCH_ERROR", error: err.message, query });
    }
  }
};

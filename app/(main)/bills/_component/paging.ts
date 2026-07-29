import { api } from "@/lib/api";

// Walk every page of a paginated endpoint and return the rows.
//
// The API caps limit at 100, so asking for "limit=500" quietly returns 10 (the
// default) — the cause of screens that were missing bills. `url` must already
// carry its query string; page/limit are appended.
export async function fetchAllPages<T>(url: string): Promise<T[]> {
  const all: T[] = [];
  const sep = url.includes("?") ? "&" : "?";
  let page = 1;
  let totalPages = 1;
  do {
    const res = await api.get<T[]>(`${url}${sep}page=${page}&limit=100`);
    all.push(...((res.data as unknown as T[]) || []));
    totalPages = (res as { total_pages?: number }).total_pages || 1;
    page++;
  } while (page <= totalPages);
  return all;
}

import { useMemo } from "react";
import type { SearchMatch, SearchState } from "../types";


export function useSearch(
  content: string,
  state: SearchState,
): { matches: SearchMatch[]; regexError: string | null } {
  return useMemo(() => {
    if (!state.isOpen || state.query === "") {
      return { matches: [], regexError: null };
    }

    if (state.useRegex) {
      try {
        const re = new RegExp(state.query, "gi");
        const matches: SearchMatch[] = [];
        let m: RegExpExecArray | null;
        while ((m = re.exec(content)) !== null) {
          matches.push({
            start: m.index,
            end: m.index + m[0].length,
            groups: Array.from(m) as string[], // [0]=全体, [1]=第1グループ, ...
          });
          if (m[0].length === 0) re.lastIndex++;
        }
        return { matches, regexError: null };
      } catch (e) {
        return { matches: [], regexError: (e as Error).message };
      }
    } else {
      const matches: SearchMatch[] = [];
      const lowerContent = content.toLowerCase();
      const lowerQuery = state.query.toLowerCase();
      let pos = 0;
      while (pos <= content.length) {
        const idx = lowerContent.indexOf(lowerQuery, pos);
        if (idx === -1) break;
        matches.push({ start: idx, end: idx + state.query.length });
        pos = idx + 1;
      }
      return { matches, regexError: null };
    }
  }, [content, state.isOpen, state.query, state.useRegex]);
}

import type { PolicyInputType } from "../policy";
import type { PolicyAgentState, StoredReview } from "../shared";

export type EditorSources = Record<PolicyInputType, string>;

export const SAMPLE_SOURCES: Readonly<EditorSources> = {
  "github-actions": `name: CI
permissions: write-all
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test
`,
  dockerfile: `FROM node:22-alpine
ARG API_TOKEN=demo-placeholder
WORKDIR /app
COPY . .
CMD ["node", "server.js"]
`
};

export function createEmptyEditorSources(): EditorSources {
  return { "github-actions": "", dockerfile: "" };
}

export function updateEditorSource(
  sources: EditorSources,
  type: PolicyInputType,
  source: string
): EditorSources {
  return { ...sources, [type]: source };
}

export function reviewForDisplay(
  state: PolicyAgentState | undefined,
  clearedThroughGeneration: number | null
): StoredReview | null {
  if (!state?.review) return null;
  if (clearedThroughGeneration !== null && state.generation <= clearedThroughGeneration) return null;
  return state.review;
}

export interface Context {
  output_language?: "en" | "vi";
  title: string;
  description: string;
  problem: string;
  objectives: string;
  questions: string;
  team_size: number;
  skills: string;
  timeline: string;
  sources: string;
  datasets: string;
  constraints: string;
}
export interface Analysis {
  summary: string;
  dimensions: { name: string; status: string; explanation: string }[];
  risks: string[];
  missing_information: string[];
  directions: string[];
  keywords: string[];
  next_steps: string[];
}
export interface Fact {
  field: string;
  value: string;
  page: number;
  quote: string;
}
export interface Evaluation {
  facts: Fact[];
  relevance: string;
  usefulness: string;
  recency: string;
  limitations: string[];
  warnings: string[];
}
export interface Evidence {
  id: string;
  source_id: string;
  page: number;
  quote: string;
  kind: string;
  content: string;
}
export interface Source {
  id: string;
  filename: string;
  page_count: number;
  status: string;
  error: string | null;
  warnings: string[];
  evaluation: Evaluation | null;
  evidence: Evidence[];
  evidence_done: boolean;
}
export interface Check {
  status: string;
  relevance: string;
  matches: { evidence_id: string; relation: string; explanation: string }[];
  citation_issue: string;
  limitation: string;
  action: string;
  explanation: string;
}
export interface Claim {
  id: string;
  text: string;
  check: Check | null;
}
export interface Draft {
  id: string;
  title: string;
  text: string;
  status: string;
  error: string | null;
  claims: Claim[];
}
export interface Project {
  id: string;
  name: string;
  updated_at: string;
  context: Context;
  confirmed: boolean;
  analysis: Analysis | null;
  sources: Source[];
  drafts: Draft[];
  comparisons: {
    evidence_ids: string[];
    relationship: string;
    explanation: string;
  }[];
  activity: string[];
  operation: { label: string; expires: number } | null;
}
export interface Summary {
  id: string;
  name: string;
  topic: string;
  confirmed: boolean;
  updated_at: string;
  sources: number;
  evaluated: number;
  evidence: number;
  drafts: number;
}
export interface User {
  id: string;
  email: string;
}

export type RunAction = (
  label: string,
  action: () => Promise<unknown>,
) => Promise<void>;
export type WorkspaceProps = {
  p: Project;
  run: RunAction;
  busy: boolean;
  base: string;
  inspect: (e: Evidence) => void;
};

import { Annotation, Project, Source } from "./types";

export const demoProjects: Project[] = [
  {
    id: "p1",
    name: "Housing Policy Analysis",
    description: "Research on zoning, affordability, and housing supply.",
    isActive: true,
    deletedAt: null,
  },
  {
    id: "p2",
    name: "AI Regulation",
    description: "Federal and state approaches to AI governance.",
    isActive: true,
    deletedAt: null,
  },
  {
    id: "p3",
    name: "Criminal Justice",
    description: "Policy and constitutional questions in criminal justice.",
    isActive: true,
    deletedAt: null,
  },
];

export const demoSources: Source[] = [
  {
    id: "s1",
    title: "Artificial Intelligence and Federal Regulation",
    authors: "Congressional Research Service",
    organization: "Congressional Research Service",
    date: "2026-07-14",
    url: "https://crsreports.congress.gov/",
    type: "Report",
    description:
      "Overview of federal agencies, statutes, and regulatory approaches relevant to artificial intelligence.",
    tags: ["AI", "regulation", "federalism"],
    projects: ["p2"],
    notes: "Useful background for mapping fragmented federal authority.",
    createdAt: "2026-08-25",
  },
  {
    id: "s2",
    title: "The Effects of Zoning on Housing Supply",
    authors: "Jane Smith",
    organization: "Policy Research Institute",
    date: "2025-10-02",
    url: "https://example.org/zoning",
    type: "Article",
    description:
      "Empirical analysis of the relationship between local zoning restrictions and housing supply.",
    tags: ["housing", "zoning", "evidence"],
    projects: ["p1"],
    notes: "",
    createdAt: "2026-08-24",
  },
  {
    id: "s3",
    title: "State v. Example",
    authors: "State Supreme Court",
    organization: "State Supreme Court",
    date: "2024-05-21",
    url: "https://example.org/case",
    type: "Case",
    description:
      "Illustrative case record for constitutional analysis and legal research workflows.",
    tags: ["criminal-justice", "constitutional-law"],
    projects: ["p3"],
    notes: "Review majority and dissent separately.",
    createdAt: "2026-08-20",
  },
  {
    id: "s4",
    title: "Housing Affordability and Local Land Use",
    authors: "Department of Housing",
    organization: "Department of Housing",
    date: "2026-01-18",
    url: "https://example.gov/housing",
    type: "Report",
    description:
      "Government report examining affordability, land use, and housing production.",
    tags: ["housing", "policy"],
    projects: ["p1"],
    notes: "",
    createdAt: "2026-08-18",
  },
];

export const demoAnnotations: Annotation[] = [
  {
    id: "a1",
    sourceId: "s2",
    selectedText:
      "Restrictive zoning is associated with lower rates of new housing construction in high-demand regions.",
    note: "Strong evidence for the supply side of my argument.",
    tags: ["evidence", "housing"],
    projects: ["p1"],
    type: "Evidence",
    createdAt: "2026-08-24",
  },
  {
    id: "a2",
    sourceId: "s1",
    selectedText:
      "Federal authority over AI is distributed across multiple agencies and statutory regimes.",
    note: "Potential framing for a federalism section.",
    tags: ["AI", "federalism"],
    projects: ["p2"],
    type: "Note",
    createdAt: "2026-08-25",
  },
  {
    id: "a3",
    sourceId: "s3",
    selectedText:
      "The court distinguishes between a facial challenge and an as-applied challenge.",
    note: "Need to compare this distinction with the newer case.",
    tags: ["constitutional-law"],
    projects: ["p3"],
    type: "Note",
    createdAt: "2026-08-20",
  },
];

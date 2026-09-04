export const walkthroughSteps = [
  {
    view: "Dashboard",
    eyebrow: "Your home base",
    title: "See your research at a glance",
    description:
      "The dashboard keeps active projects, recent sources, and your newest excerpts close at hand.",
  },
  {
    view: "Projects",
    eyebrow: "Projects",
    title: "Organize work by question or assignment",
    description:
      "Create a project, open it to see every connected source, or archive it when the work is complete.",
  },
  {
    view: "Sources",
    eyebrow: "Sources",
    title: "Build a reliable source library",
    description:
      "Save a URL for automatic citation details, enter one manually, then filter and sort your library as it grows.",
  },
  {
    view: "Annotations",
    eyebrow: "Excerpts",
    title: "Keep evidence connected to context",
    description:
      "Every highlighted passage lives with its source, project, note, page number, and reusable tags.",
  },
  {
    view: "Tags",
    eyebrow: "Tags",
    title: "Follow ideas across your research",
    description:
      "Select a tag to reveal all related sources and excerpts, even when they belong to different projects.",
  },
  {
    view: "Archived",
    eyebrow: "Archive",
    title: "Clear the workspace without losing work",
    description:
      "Archived projects stay preserved here and can be restored whenever you need them again.",
  },
  {
    view: "Dashboard",
    eyebrow: "Universal search",
    title: "Find anything from one place",
    description:
      "Use the search bar—or press ⌘ K—to find projects, sources, and tags without changing sections first.",
  },
  {
    view: "Dashboard",
    eyebrow: "Chrome extension · Save",
    title: "Capture a source while you browse",
    description:
      "Open the Marginalia extension on an article, review the detected citation details, choose a project, add tags, and save.",
    extension: "source",
  },
  {
    view: "Dashboard",
    eyebrow: "Chrome extension · Excerpt",
    title: "Turn a highlight into usable evidence",
    description:
      "After saving a source, highlight text on the page. Add a note, tags, and an optional page number in the popup, then save the excerpt.",
    extension: "excerpt",
  },
  {
    view: "Settings",
    eyebrow: "You’re ready",
    title: "Make Marginalia your own",
    description:
      "Adjust appearance here and restart this walkthrough at any time. Your workspace is ready for the next research question.",
  },
] as const;

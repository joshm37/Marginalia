// The extension build replaces this source-only guard with compiled shared utilities.
throw new Error(
  "Marginalia is loaded from its source folder. Run npm run extension:build, then use Chrome's Load unpacked to select .extension-build/marginalia in the project folder. Reloading the source-folder entry cannot load the PDF tools.",
);

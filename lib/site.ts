/**
 * Single-operator site identity — used everywhere structured data (JSON-LD,
 * reviewedBy) needs to name the same entity consistently. A name that's
 * hardcoded independently in multiple files can drift out of sync silently;
 * importing from here means a future change is one edit, not a grep.
 */
export const SITE_NAME = "Engineerious";
export const AUTHOR_NAME = "Tharun Chowdary Malepati";

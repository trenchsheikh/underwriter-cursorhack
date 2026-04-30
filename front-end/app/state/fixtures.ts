/**
 * Client-only demo data for the prompt-zone scenario buttons.
 *
 * The actual diligence run is now fully driven by the backend SSE
 * stream (see app/lib/run.ts). These constants drive *only* the
 * pre-run UX: the typewriter prompt and the file-pill staggered
 * append. The `ref` fields point at backend fixture variants so the
 * server can find the matching SPA / wire instructions.
 */

import type { PromptFile } from "../lib/runReducer";

export const DEMO_PROMPT = `Wire $2,000,000 to Acme Robotics for their Series A.
Lead is Sequoia. 50% pro-rata of our $4,000,000 allocation.
SPA and wire instructions attached.`;

export const DEMO_FILES_CLEAN: PromptFile[] = [
  {
    name: "acme_spa.pdf",
    mime: "application/pdf",
    size: 124000,
    sizeLabel: "124 KB",
    icon: "file-text",
    ref: "clean-acme",
  },
  {
    name: "wire_instructions_clean.pdf",
    mime: "application/pdf",
    size: 38000,
    sizeLabel: "38 KB",
    icon: "file-text",
    ref: "clean-acme",
  },
];

export const DEMO_FILES_BEC: PromptFile[] = [
  {
    name: "acme_spa.pdf",
    mime: "application/pdf",
    size: 124000,
    sizeLabel: "124 KB",
    icon: "file-text",
    ref: "bec-acme",
  },
  {
    name: "wire_instructions_bec.eml",
    mime: "message/rfc822",
    size: 12000,
    sizeLabel: "12 KB",
    icon: "mail",
    ref: "bec-acme",
  },
];

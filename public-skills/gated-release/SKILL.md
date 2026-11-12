---
name: gated-release
description: Run or build a gated, reproducible release (site deployment, regenerated asset layer, or methods-repository publication) with recorded approvals, pinned hashes, drift refusal and a generated review record.
---

Keep one folder per release. It holds the inputs, the state of each step, the approvals verbatim, evidence per attempt and a generated review. Never hand-edit the review. Let the tool write every hash ("pins"); a pin never changes, so a different value means a new release id.

Treat every step as repeatable. A passed step re-verifies its recorded files and does nothing more. A failed or interrupted step is rerun as a new attempt. Before any step runs, re-hash the files its prerequisites recorded and refuse on drift. Freeze the release inputs once the package exists. Create outputs exclusively; never overwrite.

Gates are recorded approvals, never skipped. An owner's approval counts only when given directly to the agent that will act. That agent records it on its own machine, with the exact words and a prefix of the hash or commit that was approved. Record relayed approvals for context; they never satisfy a gate. A reviewer approves publication of an exact commit and tree; if anything changes, the candidate needs a new review.

Read the baseline from an append-only record of live releases, not from memory. Freeze by building twice, once from a clean copy of only the build inputs, and require identical bytes. Package derived assets only as listed in their index, pinned through their audit chain. Use one generic deployment script driven by a per-release configuration file; do not patch code per release. Verify by re-extracting the archive and requiring an exact manifest with no links or traversal. Keep a replay of a shipped release as the tool's acceptance test.

On the host, prepare without touching production, then promote only the application. Fingerprint everything the release must not change before and after each phase. After promoting, and before trusting a retried promotion, verify read-only that this candidate is what is running now: a leftover success summary is not proof. Prefer detached phases with durable logs and exit records written once, so a dropped connection cannot stop a swap halfway. Test the real command-line entry point, not only the functions behind it.

Take browser screenshots only after the drawing has settled:
- use a predicate that never throws;
- treat the view as complete when every tile the page's latest frame requested is uploaded, never by a fixed tile count;
- then require advancing frames and quiet polls;
- call finish, then take the shot;
- read the state after the shot, and write metrics before any assert.

Gate the picture on textured content, calibrated on real accepted and rejected captures.

For publication, commit only allowlisted files in an isolated clean clone. Build a reviewer pack: exact archive tree, manifest, history, refs, tests, secret scans, metadata of every pinned binary, and the push command. After approval, push only that commit as a fast-forward. Then verify the remote tree, blobs, modes, CI and settings. Run the publication check yourself on a fresh repository of exactly the allowlisted files before handing over a candidate.

Test the tool with fakes called by absolute path. Check "nothing written" with before-and-after snapshots of the folder. Add a regression test for every review finding, and list changed files with hashes for each review round.

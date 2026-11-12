# Reusable agent workflows

These project-specific skills generalise the engineering workflow. They are freshly written, not exports of private agent instructions or conversation history. Each folder contains a self-contained `SKILL.md` with its trigger and constraints. Copy the desired folder to your agent's supported skill location, or read it directly.

- [terrain-map-review](terrain-map-review/SKILL.md): terrain, geometry and projection consistency.
- [guarded-map-painting](guarded-map-painting/SKILL.md): spot review, immutable runs and layout-preserving painting.
- [methods-only-publication](methods-only-publication/SKILL.md): publish methods without local datasets or operational traces.

The skills do not contain provider credentials, a production setup or permission to publish data. Follow the actual user's scope and approval conditions.

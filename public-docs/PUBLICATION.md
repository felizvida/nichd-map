# Methods-only publication boundary

The public tree is explicitly listed in `PUBLIC_FILES.json`. The root ignore rules deny all other paths by default. The allowlist is a review boundary, not permission to include data in an allowed code file.

The public content consists of generic methods, synthetic tests, documentation, reusable workflow instructions, CI and one fictional banner. Local datasets, actual models, imagery, directory information, production builds, tiles, run evidence, deployment configuration, agent conversations and original application source remain outside the publication tree.

`publication/check.py --ref HEAD` checks the committed tree, not the working directory. `--staged` checks the Git index before committing. It requires exact allowlist membership, ordinary file modes, bounded size, reviewed text extensions, a pinned banner hash and selected disclosure patterns. It emits a SHA-256 manifest. It does not prove absence of private information: content review and a secret scanner remain separate checks.

For a first publication, inspect every existing commit and all candidate reachable objects. For later updates, inspect the diff and newly reachable history. Export the exact commit to an isolated directory, run the tests and a current secret scanner there, and have the designated reviewer inspect that export. Do not scan or upload the original private workspace to an external service.

Use a clean, isolated checkout for a normal single-branch push. Leave the private workspace without a public remote. Do not force-push, push all refs, or automatically tag local operational releases. Git ignores do not prevent a forced add: future publication requires the same explicit review.

Repository metadata should describe the methods. Use the repository itself as the homepage, relevant method topics, useful issue labels, the existing Apache-2.0 licence, contribution/security guidance and the fictional banner. Do not link operational endpoints or use a real map screenshot as a social preview.

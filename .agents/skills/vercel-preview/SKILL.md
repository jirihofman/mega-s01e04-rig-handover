---
name: vercel-preview
description: Export a rig page as static HTML, publish it on Vercel for review, and replace it without its lane marker after review. Use for this repository's static review previews.
---

# Vercel review preview

Follow ADR 0003. Keep the HTML export, logs, `.env`, and Vercel project state outside the
repository. Deploy only the staging directory, never the service checkout or its parent.
Use curl with its default User-Agent for HTTP requests. No Git integration is needed.

## Establish the destination

Use `vercel whoami` and `vercel teams ls` to check the existing account and scope.
Ask before creating an account, spending money, or publishing. Existing explicit approval
for the named action remains valid; this skill does not authorize a deployment by itself.

S01E04 used scope `jirihofmans-projects`, project `mega-s01e04-rig-preview`, and public URL
`https://mega-s01e04-rig-preview.vercel.app`. These identify the existing challenge preview;
do not overwrite it for a different task without authorization. Its local staging directory
was `../private/preview` relative to the service checkout. Choose a separate directory and
project for a new preview, and confirm the intended account, audience, and replacement path.

## Export and publish

1. Run the service locally with the intended marker in its untracked `.env`. Export the
   requested page using a command, not browser “save as.” For the original sample:

   ```sh
   curl -fsS http://localhost:8787/digest/2026-10-28 -o ../private/preview/index.html
   ```

   Verify expected rows, lane banner, inline styles, and absence of client scripts or external
   assets. The directory must contain only public sample data and the intended marker.

2. Put this `vercel.json` beside `index.html` in the staging directory:

   ```json
   {
     "framework": null,
     "buildCommand": null,
     "outputDirectory": ".",
     "headers": [{
       "source": "/(.*)",
       "headers": [{ "key": "Cache-Control", "value": "no-store" }]
     }]
   }
   ```

3. Before the first upload, obtain approval naming the project, account, public contents,
   purpose, and how to remove or replace the deployment. Once authorized, run `vercel link`
   from the staging directory to select or create the approved project. Check its generated
   `.vercel/project.json` against that destination. For an already linked staging directory:

   ```sh
   vercel deploy --prod --yes --scope <approved-scope>
   ```

   Save stdout and stderr outside the staging directory. The original run used the deprecated
   `--name` option; prefer project linking for future runs. Do not use `--public`: it exposes
   source browsing and is not needed to make the production page readable.

4. Read the stable production alias from the deployment result or `vercel inspect`. Do not
   submit an immutable deployment URL. Fetch the production alias with unauthenticated curl,
   without cookies or protection-bypass headers, and compare it to the exported HTML:

   ```sh
   curl -fsS "$preview_url" -o "$verification_file"
   cmp "$staging_dir/index.html" "$verification_file"
   ```

   Confirm the page itself is returned, not a sign-in page. If access is protected, investigate
   project settings; do not silently weaken protection. Stop on deployment or verification
   failure, inspect the output, and fix the identified cause before submitting anything.

## Review and cleanup

Send the verified production URL to the authorized reviewer; for this challenge use the
course claim tool with the repository and the same preview URL on every call. Preserve
requests and replies privately. Keep the review issue open until confirmation that the
reviewer has seen the page. Respect any retry interval; leave the public marker intact.

After review, ask for the separately required replacement approval. Explain that the same
public URL will show “no marker set.” Vercel retains deployment history; updating an alias
does not erase the old deployment. Deleting old deployments is a separate action requiring
authorization when needed.

Export a new page from the running service with no marker. Since the start command loads
`.env`, merely unsetting the shell variable would reload the marker from that file. For this
service, an explicit empty override renders the required “no marker set” banner:

```sh
PORT=8788 LANE_MARKER= pnpm start
```

Fetch the same route on that port into a private candidate file. Verify the old marker is
absent, “no marker set” is present, and all other page content matches. Only after approval,
replace staging `index.html` and deploy from the same linked directory with `--prod`.
Fetch the same production URL again without credentials and verify the clean export matches.

Finish only after public verification: archive the plan in `docs/plans/done/` with its issue
URLs, commit and push, and close cleanup with the worker comment from AGENTS.md. Never invent
model or effort metadata. Resubmit the same answer to the course and wait for its acceptance;
a successful deployment alone does not mean the challenge is solved.

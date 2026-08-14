# Cold Brew Cartel: Lovable handoff

This folder is a self-contained specification for rebuilding the existing single-browser game as a synchronized three-player Lovable application.

The original game is preserved at `source/index.html`. Treat it as the authority for visual design, teaching copy, motion, responsive behavior, and payoff logic. The other files describe the multiplayer additions.

## What this kit is for

Lovable cannot start a project by importing an existing GitHub repository. It can, however, read uploaded HTML, Markdown, JSON, and ZIP files and build from them. This kit uses that supported path.

References:

- https://docs.lovable.dev/integrations/github
- https://docs.lovable.dev/features/generate-files
- https://docs.lovable.dev/integrations/cloud

## Build sequence

1. Go to https://lovable.dev and create a new blank project named **Cold Brew Cartel**.
2. Upload `cold-brew-cartel-lovable-kit.zip` to the project chat.
3. Open Lovable's Plan mode and paste **Prompt 1** from `LOVABLE_PROMPTS.md`. Review its summary before allowing code changes.
4. Return to Build mode and paste **Prompt 2**. This creates the visual frontend with a mock room service. Check the landing, lobby, lesson, huddle, decision, and result screens at desktop and phone widths.
5. Enable Lovable Cloud in the **Americas** region. Region selection cannot be changed after Cloud is enabled.
6. Paste **Prompt 3** to replace the mock room service with the authoritative multiplayer backend.
7. Open three isolated browser sessions: a normal window, an incognito window, and a second browser or phone. Complete the three-device smoke test in `ACCEPTANCE_TESTS.md`.
8. Paste **Prompt 4** for security and automated-test hardening. Review and resolve every high-severity database or access-control finding.
9. Paste **Prompt 5** for final visual and accessibility QA.
10. Publish the Lovable project and repeat the smoke test against the public URL before sharing it with students.

## Optional GitHub connection

Connect the completed Lovable project to GitHub only after Lovable has created it. Lovable creates the repository and then supports two-way synchronization on its default branch; it does not import this existing folder as the starting project.

## Non-negotiable launch checks

- The site opens with **I'm the spokesperson** and **Join my group** actions.
- Room codes are selected from the exact 200-word pool and are case-insensitive.
- Three different browsers synchronize without manual refresh.
- A fourth player cannot join.
- Before reveal, no participant—including the spokesperson—can obtain another cart's price.
- All eight price combinations match `game-rules.json`.
- Only the spokesperson can advance phases, reveal, and replay.
- Refreshing a browser restores its seat and role from its local guest token.


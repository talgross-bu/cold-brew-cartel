# Cold Brew Cartel

A synchronized, three-player classroom pricing game. One student creates a room as the spokesperson, shares a simple word code, and controls the teaching flow. The three carts make private price choices on separate devices and Supabase reveals the combined market outcome.

**Live game:** https://talgross-bu.github.io/cold-brew-cartel/

The original single-browser game remains at `index.html`. The multiplayer React application is in `app/`; the Supabase backend is in `supabase/`.

## Architecture

- React 19 + TypeScript + Vite static frontend
- Supabase Anonymous Auth, PostgreSQL, and Realtime Broadcast
- Five RLS-protected tables with no browser table access
- Atomic `SECURITY DEFINER` RPCs for create, join, transition, choose, and reveal
- Exactly 200 case-insensitive classroom-safe word codes
- GitHub Pages deployment on every push to `main`

## Local setup

1. In Supabase, open **Authentication → Providers → Anonymous Sign-Ins** and enable anonymous sign-ins.
2. Open **Project Settings → API Keys** and copy the project's publishable key (`sb_publishable_…`). This key is designed for browser use; never use a secret/service-role key in the frontend.
3. Create `app/.env.local` from `app/.env.example` and replace the placeholder with the publishable key.
4. Apply the database migration:

   ```sh
   npx supabase login
   npx supabase link --project-ref dkjglcqjamhkuypprwsf
   npx supabase db push
   ```

5. Run the app:

   ```sh
   cd app
   npm install
   npm run dev
   ```

Open the displayed local URL in three separate browser profiles or devices to test a full room.

## Verification

From `app/`:

```sh
npm test
npm run build
npm audit
```

The economics tests cover all eight possible three-cart price profiles.

## GitHub Pages

Before the first deployment:

1. In the GitHub repository, add an Actions variable named `SUPABASE_PUBLISHABLE_KEY` containing the browser-safe publishable key.
2. In **Settings → Pages**, choose **GitHub Actions** as the source.
3. Push `main`, or run **Test and deploy game** manually from the Actions tab.

No Supabase secret key is stored in the repository or sent to students. The project URL and publishable key are public connection identifiers; database authorization is enforced by Auth, RPC checks, grants, and RLS.

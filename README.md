# Friend Place

A daily social game where players place themselves and friends on a 2D graph with custom axes (e.g. "Gimli vs Legolas", "Muffin vs Pancake"). Built with Next.js 16, React 19, Tailwind CSS 4, Framer Motion, and Supabase (Postgres, Auth, Realtime).

## Current features

- **Create a game** — Landing page: axis labels, player names, end time. Creator gets a shareable invite link.
- **Join & claim a name** — Open the link, pick your name from the list (or add yourself). You can **edit** your display name or **switch** to a different name later.
- **Place on the graph** — Drag yourself onto the 2D graph, then drag each friend onto the graph. Partial submission allowed; you can return to place more friends later.
- **Dashboard** — After submitting: see progress (X of N placed), add players, copy invite link, view placement counts for everyone. **Host** can **end game** at any time.
- **Realtime** — Player list and game phase stay in sync across clients.
- **AI axis suggestions** — Optional daily axis prefill and “suggest axes” / regenerate one axis (Anthropic Claude). See `docs/ai-setup.md` for API key setup and prompts.

See `docs/components.md` for component architecture, `docs/security-and-privacy.md` for account login and merge security, `docs/ai-setup.md` for AI (Anthropic) setup and prompts, and `.cursor/plans/friend_place_game_plan_fd997aac.plan.md` for the full build plan and phase status.

## Getting Started

1. **Environment:** Create `.env.local` in the project root with at least `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. For AI axis suggestions, add `ANTHROPIC_API_KEY` (see `docs/ai-setup.md`).
2. **Run the dev server:**

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

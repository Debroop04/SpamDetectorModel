# Call Shield web app

Next.js 16, React 19, Tailwind CSS 4, Leaflet maps and the Twilio Voice SDK.

```bash
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env
npm run dev            # http://localhost:3000
```

Setup, Twilio and email instructions are in [../README.md](../README.md).

| Folder | Contents |
|---|---|
| `app/(auth)` | Sign in and registration |
| `app/(app)` | Dashboard, calls, police reports, map, numbers, test call, settings |
| `components/ui` | Buttons, fields, cards, badges, dialogs, toasts |
| `components/calls` | Live call card, transcript, call details sheet |
| `components/map` | Leaflet map (client only) |
| `lib` | API client, auth, live updates (Server-Sent Events), theme |

Design rule: solid colors only, no gradients. CI fails if one is added.

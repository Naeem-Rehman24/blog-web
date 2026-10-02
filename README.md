# Field Notes frontend

A responsive editorial blog frontend built with React and Vite.

## Run locally

Install dependencies and start the Vite development server:

```bash
npm install
npm run dev
```

Create a production build with `npm run build`.

Open `/admin.html` in the Vite app for the separate editorial workspace. It supports post management, member and role management, permission previews in local mode, and an activity log.

## Backend connection

Copy `.env.example` to `.env.local`, then set `VITE_API_BASE_URL` to the backend origin, for example `http://localhost:5000`. Restart Vite after changing the value. When configured, the public site reads `GET /api/posts`; the admin portal uses the authenticated API instead of local storage. Leave the variable unset to use the local demo workspace.

The backend contract expected by this frontend is:

- `POST /api/auth/login` accepts `{ "email": "...", "password": "..." }` and establishes an HTTP-only session cookie; `POST /api/auth/logout` clears it.
- `GET /api/admin/bootstrap` returns `{ "currentUser": { "id": "...", "name": "...", "email": "...", "roleId": "..." }, "permissions": ["posts.view"], "posts": [], "users": [], "roles": [], "logs": [] }` for the authenticated user.
- `GET /api/posts` returns published posts as an array or `{ "posts": [] }`.
- `POST /api/admin/posts`, `PUT /api/admin/posts/:slug`, `PATCH /api/admin/posts/:slug/status`, and `DELETE /api/admin/posts/:slug` manage posts.
- Posts include a `featured` boolean. The backend must allow at most one published featured post: creating/updating one as featured should atomically clear the previous feature, and moving a featured post to draft should clear its feature flag. `GET /api/posts` should include the selected feature.
- `POST /api/admin/users/invitations`, `PATCH /api/admin/users/:id`, and `DELETE /api/admin/users/:id` manage users and invitations.
- `POST /api/admin/roles`, `PATCH /api/admin/roles/:id`, and `DELETE /api/admin/roles/:id` manage roles and permissions.
- `DELETE /api/admin/activity` clears activity. The server should create audit events for admin mutations and return them in the bootstrap response; actor identity must come from the authenticated session, not the client.

The API must enforce every permission server-side. For cookie sessions, configure CORS to allow the frontend origin with credentials. The local workspace and role preview are development fallbacks only, not authentication or a security boundary.

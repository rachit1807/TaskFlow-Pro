# TaskFlow Pro

TaskFlow Pro is a multi-workspace project and task management app built with MongoDB, Express, React, and Node.js. It includes workspace roles, project and task workflows, team invitations, comments, activity history, and in-app notifications.

## Features

- Email and password registration, sign-in, sign-out, and session lookup. Passwords are hashed and sessions use secure HTTP-only cookies.
- Workspace membership with owner, admin, manager, and employee roles, plus expiring invitation links.
- Projects with descriptions, status counts, and archive/restore.
- Tasks with descriptions, priority, due dates, labels, status, project, assignees, priority filters, search, pagination, and archive.
- Kanban board with status changes, task detail editing, comments, and private file attachments (PDF, images, text/CSV, ZIP, and Office documents up to 5 MB).
- Workspace activity history and in-app notifications for assignments and comments.
- Responsive dashboard, project and team views, and sample data for a non-authenticated preview.
- API health endpoint at `/api/health`.

## Run locally

Requirements: Node.js 20.19+ or 22.12+ and MongoDB Community Server or MongoDB Atlas.

1. Copy `.env.example` to `.env`.
2. Set `MONGODB_URI` and a unique random `JWT_SECRET` (at least 32 characters).
3. Install dependencies with `npm install`.
4. Run `npm run dev` from this directory.
5. Open `http://localhost:5173`.

The API runs at `http://localhost:4000`. The UI preview works without MongoDB, but account and workspace features require a working database connection.

## Deploy on Render

The included `render.yaml` defines a static React site and an Express API. Connect this repository to Render as a Blueprint, then provide `MONGODB_URI` for the API service. Render generates `JWT_SECRET` and wires the web/API URLs. The free web service may spin down after inactivity; see [Render's free instance limits](https://render.com/docs/free). MongoDB Atlas offers a free sandbox cluster for development; configure its network access and database user before deploying.

## Architecture

```text
apps/web       React + Vite user interface
apps/api       Express API, authentication, workspace and product routes
packages/shared Shared task statuses and priorities
```

The API is workspace-scoped: authenticated requests to workspace resources include `X-Workspace-Id`, and the server checks membership and role permissions before returning or changing data. MongoDB models define users, memberships, workspaces, projects, tasks, attachments, comments, activities, notifications, and invitations. Attachments are stored in MongoDB and are protected by workspace membership checks.

## Environment variables

See `.env.example`. Production secrets belong in the hosting provider's environment settings and must not be committed.

## Current scope

This repository contains the application features listed above. Email delivery, file storage, realtime push updates, and production observability are not configured in this version; these require provider credentials and additional integration work before use as a production service.

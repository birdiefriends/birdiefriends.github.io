# BirdieFriends Plans (side plans around an event)

Status: building (v4.64.0). Author: Brian + Claude. Date: 2026-11-13.

## What it is
Players already text each other to organize things around a golf event: a pre-round breakfast, a post-round bar,
a seminar, a demonstration. A **Plan** is a small, self-contained thing attached to an event: a title, a time, a place,
a description, and a Yes / Maybe / No RSVP with a live count (plus guests). It replaces the group text.

Plans live in their own window, a small "plan world", opened from an icon on the event card (like Photos, Notes, Rules).
Nothing is added to the card itself, so the card stays clean on game day. The window is a container: RSVP is the first
module; notes, checklists and more can be added later without changing the structure.

## Who sees and does what
Three roles relative to a Gathering: **Host**, **Player** (said Yes to the golf event), **Invited** (on the invite
list: the Crew, or any member when the Gathering is open, or anyone who has answered it).

| Action | Host | Player (golf Yes) | Invited (not a Yes) |
|---|---|---|---|
| See the Plans icon and a plan's basics (title, time, place, description, counts) | yes | yes | yes |
| Create a plan | yes | yes (default) | only if the host allows it |
| RSVP, see who is going, read notes | yes | yes | only on a plan that is open to everyone invited |
| Edit or cancel a plan | any plan | their own | their own |

Two small controls keep it from getting unruly:

1. **Per Gathering (host setting) "Who can create plans":** `players` (default), `invited` (a non-player may hold a
   seminar, demo or happy hour), or `host` (no side plans).
2. **Per plan "Who can join":** `invited` = everyone on the invite list (default), or `players` = golf Yes only
   (a players-only dinner). The creator and the host always have full access to their plan.

The host can cancel any plan. A plan expires with its event (hidden once the event has passed).

## Notifications
One push to the players (golf Yes) when a plan is created, so nobody has to text. Nothing else pushes by default: no
chat thread, no "X joined" noise. RSVP changes are visible in the window. (A push to the creator on RSVP changes is a
possible later option.)

## Data (main Worker, D1, created on first use, so no manual migration)
- `gathering_plans(id, gathering_id, creator_id, title, starts_at, place, description, notes, audience, status, created_at, updated_at)`
  `audience` = `invited` | `players`; `status` = `active` | `cancelled`.
- `plan_rsvps(plan_id, player_id, status, guests, updated_at)`, primary key (plan_id, player_id); `status` = `yes` | `maybe` | `no`.
- `gathering_plan_settings(gathering_id, who_can_create, updated_by, updated_at)`.

## API (main Worker)
- `GET  /plans?gathering_id=&player_id=` : the viewer's access, whether they can create, the setting, and the plans
  (with what the viewer is allowed to see: attendees and notes only when they have full access).
- `POST /plans` `{gathering_id, player_id, title, starts_at?, place?, description?, notes?, audience?}` : create.
- `POST /plans/:id` `{player_id, ...fields}` or `{player_id, status:'cancelled'}` : edit or cancel (creator or host).
- `POST /plans/:id/rsvp` `{player_id, status, guests?}` : RSVP (needs full access to the plan).
- `POST /plans/settings` `{gathering_id, host_id, who_can_create}` : the host setting.
POST is used for edits because the Worker's CORS list has no PUT (same as the group-sets routes).

## Reuse
The plan container is keyed by `gathering_id` today. BFE events, Series and Cup events can use the same tables and
window through a different scope key later.

## Not in v1
Chat or comments, checklists, notes edits by attendees, payments, recurring plans, plans for non-Gathering events.

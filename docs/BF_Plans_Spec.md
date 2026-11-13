# BirdieFriends Plans (side plans around an event)

Status: shipped (v4.64.0 to v4.67.0, Dev-99); announcements not built. Author: Brian + Claude. Date: 2026-11-13.

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
chat thread, no "X joined" noise. RSVP changes are visible in the window.

**Creator push:** the plan's creator gets one push when someone's RSVP changes ("Name is in (+2 guests)", "is a maybe",
"can no longer make it"). Not sent for the creator's own RSVP, when the answer did not change, or for a first-ever No.
The RSVP call accepts `notify: false` to suppress it. Push only, same OneSignal `player_name` tag path as the create push.

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

## As built (Dev-99, v4.64.0 to v4.67.0)
Additions to the design above, all shipped:
- **Count-me-in plans (`default_yes`):** every golf Yes player counts as going until they decline (used for the Turkey 2Man awards party). Players are not stored as RSVPs until they answer; the Worker computes the assumed rows on read, so late Yes players are counted and removed golf Yes players drop out.
- **Launch prompt ("Are you in?"):** `GET /plans/pending?player_id=` returns the plans a golf Yes player has not answered (upcoming Gatherings only, never their own plans), plus a Gathering id list for the red dot. The prompt opens on app launch and right after a new golf Yes. It is skipped over a live round (launch only) and over another open dialog; "Not now" holds for the session, except right after a fresh Yes. Opt-in plans list who is going (first 8, then +N); count-me-in plans show only the count.
- **Counts on the card:** `GET /plans/summary?player_id=` gives active plan counts per visible upcoming Gathering for the "Plans · N" label on the event card and the My Schedule row.
- **Unregistering:** `GET /plans/mine` lists the player's Yes/Maybe plans (not ones they made); `POST /plans/leave {gathering_id, player_id, plan_ids?}` sets them to No. The dialog ticks everything by default; players-only plans are locked. Safety net on read: a players-only plan counts only people who still have the golf Yes (creator and host always count).
- **Limits:** 20 active plans per Gathering, up to 5 guests per RSVP, title 80 / description 1000 / notes 2000 characters.
- **Collapsed card:** shows the first 6 going names for opt-in plans the viewer can join.
- **Not built:** plan announcements (design agreed: "Message attendees" for the creator and host, one push to Yes and Maybe players, latest message pinned on the plan card with a timestamp, about 3 per plan per day, push only, no SMS or contact info); Plans for Series/Cup events; notes and checklist modules; a push when a plan is edited or cancelled; cancelling a creator's plans when they unregister.

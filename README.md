# Vita Modular Project Hub — Developer Setup Pack

This pack contains everything you need to deploy the Vita Modular Project
Hub and add the shared backend that lets multiple users edit the same data.

The hub now supports three project types: **extensions, annexes, and garden
rooms** — each with their own colour, classification, and slot in every
dashboard panel and report.

---

## What's in this pack

```
.
├── README.md                                          (this file)
├── vita_modular_contract_hub.html                     The hub itself.
├── Vita_Modular_Backend_Specification.pdf             What you'll be building.
├── Vita_Modular_Backend_Specification.docx            Editable source.
├── Vita_Modular_Project_Hub_User_Guide.pdf            What it does, for context.
├── Vita_Modular_Project_Hub_User_Guide.docx           Editable source.
└── apps_script_tracker.gs                             Google Apps Script
                                                      pulling quotes from
                                                      the master tracker.
```

---

## Recommended reading order

1. **`Vita_Modular_Project_Hub_User_Guide.pdf`** — read this first to understand
   what the hub does end-to-end. 30 minutes. Skim once you've got the gist.
2. **`Vita_Modular_Backend_Specification.pdf`** — the brief for your work.
   Recommended stack, database schema, file storage, realtime, cutover plan,
   effort estimate. Read in full — about 30-40 minutes.
3. **`vita_modular_contract_hub.html`** — open in a browser. Click around. The
   `dataStore` object near the top of the script is where all your changes
   will land. Find it by searching for `const dataStore`.

---

## Setup checklist (the short version)

Full instructions are in section 9 of the backend specification. Brief outline:

1. **Repository** — create a new GitHub repo, copy `vita_modular_contract_hub.html`
   to it as `index.html`. Add a `netlify.toml` (template in spec section 9.2).
2. **Netlify** — connect the repo, deploy. Enable site password protection
   (Pro plan, $19/site/month).
3. **Supabase** — create a new project. Run the schema SQL (spec section 4)
   to create all tables and RLS policies. Create the two storage buckets
   (`project-files`, `works-photos`). Note the project URL and anon key.
4. **Configure the hub** — in `index.html`, find the configuration block
   near the top of the second `<script>` tag and set the Supabase URL and
   anon key.
5. **Implement `dataStore`** — replace each method body with a Supabase SDK
   call. The method signatures stay the same; the rest of the hub doesn't
   change. Spec section 7 has worked examples.
6. **Realtime subscriptions** — wire up `supabase.channel()` subscriptions
   for each shared table. Spec section 6 has the pattern.
7. **Cutover** — each existing hub user exports their localStorage data to
   JSON via Settings → Export everything, then imports into the new
   backend-backed hub. Spec section 8 covers the merge process if multiple
   users have overlapping data.

---

## Project type classification

Each project is classified as `'extension'`, `'annexe'`, or `'garden'` by
the `projectType()` function (search for `function projectType` in the
hub HTML). The classification rules:

- **Garden Room** — `trackerSource` contains "garden", OR `extType` matches
  garden room / garden studio / garden office / garden gym patterns.
  (Checked first to avoid mis-classification.)
- **Annexe** — `trackerSource` contains "annexe", OR `extType` contains
  "annexe" or "1/2/3 bedroom".
- **Extension** — everything else (the default).

When the master tracker forwards a new quote to the hub, the
`trackerSource` field is what decides type — set it to "Garden Room Web Form",
"Annexe Web Form", etc. as appropriate. The included Apps Script handles
this automatically.

---

## Apps Script tracker (existing infrastructure)

`apps_script_tracker.gs` is the existing Google Apps Script that the
quote forms POST to and the hub GETs from. It's the source of incoming
quotes today. Keep it running unchanged — when you implement the
Supabase backend, the hub still calls `syncFromTracker()` to pull new
quotes from the script's GET endpoint and write them into Supabase.

The deployed Apps Script URL is configured in `index.html` via the
`HUB_TRACKER_URL` constant. The current value should already be set;
only change it if the script is re-deployed at a new URL.

---

## What's already built (so you don't redo it)

The frontend has been deliberately structured to make the backend
swap as low-risk as possible. Already in place:

- **`dataStore` abstraction** — every read/write goes through one
  object. Swap implementations in one file.
- **Async-first methods** — every dataStore method returns a Promise,
  so swapping in network calls is transparent at every callsite.
- **Schema versioning** — `HUB_VERSION` and `SCHEMA_VERSION` constants
  with a `SCHEMA_MIGRATIONS` registry. Same schema and migrations
  apply to the database — see spec section 4.10.
- **Auto-migration on boot** — old data is upgraded automatically; a
  pre-migration backup is taken first.
- **Settings modal** — gear icon in the topbar. Includes Export
  everything, Import, Restore from pre-migration backup, and a
  danger-zone Wipe button. The Export/Import pair is also the cutover
  mechanism for moving users from localStorage to backend.
- **Version stamp** — visible at the bottom of the dashboard, so users
  can confirm what version they're on.
- **Three project types** — extensions, annexes, garden rooms. Each
  with its own colour (terra / teal / green), classification, and
  presence in every dashboard panel, filter, and export.

---

## Questions for the team to confirm before starting

(From spec section 10.4)

1. Is the Netlify Pro plan budgeted? ($19/site/month for password protection.)
2. Is the Supabase Pro plan budgeted? ($25/month, recommended for production.)
3. Preferred staging URL convention for testing before cutover?
4. Who owns the cutover walkthrough call with users?
5. Who has admin access to the Netlify and Supabase dashboards once live?

---

## Estimated effort

11–14 days (~3 weeks) for a developer familiar with JS and SQL but new
to Supabase. Add 20–30% if Supabase is unfamiliar. Detailed task
breakdown in spec section 10.1.

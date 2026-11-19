# The plan file — what `write-seed-docs.mjs` takes

One JSON file, six optional top-level keys, one per spec sheet. Run it from the skill
directory:

```bash
node scripts/write-seed-docs.mjs /tmp/<slug>-plan.json /absolute/path/to/<slug>
```

It prints what it wrote and exits 2 with a specific message if anything is wrong. Omit a
key entirely and that sheet is left untouched — so you can fill the sheets in two passes
if the plan is still forming.

```
seed-documentation written:
  App Outline - Application Overview.csv — 21 filled, 3 left blank
  App Outline - Design & Style Guide.csv — 18 filled, 11 left blank
  App Outline - Functional Requirements (User Stories).csv — 7 row(s)
  App Outline - Application Pages_Views.csv — 5 row(s)
  App Outline - Data Model (Database Structure).csv — 23 row(s)
  App Outline - API Routes and Core Logic.csv — 12 row(s)
```

---

## The two key-value sheets

`overview` and `design` are objects keyed by the sheet's own first column — `Field` for
Overview, `Element` for Design. The script keeps every row, its description and the row
order exactly as shipped, and writes only the `Value` column. **A key that isn't a real
row name is a hard error** listing the valid names, which is how you catch
`"App name"` vs `"App Name"`.

Values can be a string, an array (joined with `; `), or `{ "value": "...", "notes": "..." }`
on the Design sheet, which also has a `Notes` column.

```json
{
  "overview": {
    "App Name": "Dog Walk Tracker",
    "Tagline": "Log every walk, and show clients exactly what happened.",
    "User Roles": ["walker", "admin"],
    "Out of Scope": "Payments, client-facing login, email summaries"
  },
  "design": {
    "Theme Mode": "User-Selectable",
    "Primary Accent Color": { "value": "#2f6f4f", "notes": "Deep green, picked to feel outdoorsy" },
    "Icon Library": "Lucide",
    "UI Framework": "shadcn/ui"
  }
}
```

Valid `overview` fields, in sheet order: `App Name`, `Tagline`, `Primary Goal`,
`Target Audience`, `Problem Solved`, `Key Differentiator`, `Monetization Strategy`,
`Pricing Tiers`, `Core User Workflow`, `User Roles`, `Authentication Method`,
`Required Integrations`, `Optional Integrations`, `Tech Stack — Frontend`,
`Tech Stack — Backend`, `Tech Stack — Database`, `Tech Stack — Other`,
`Hosting / Deployment`, `Domain / URL`, `Out of Scope`, `Constraints`, `Success Metrics`,
`Inferred Complexity`, `Notes`.

Note the em dash in the `Tech Stack — …` fields. Copy it rather than typing a hyphen.

Valid `design` elements, in sheet order: `Theme Mode`, `Default Theme`,
`Primary Accent Color`, `Secondary Accent Color`, `Tertiary / Highlight Color`,
`Background Color — Light`, `Background Color — Dark`, `Surface / Card Color`,
`Text Color — Primary`, `Text Color — Muted`, `Success Color`, `Warning Color`,
`Error / Destructive Color`, `Font Family — Heading`, `Font Family — Body`,
`Font Family — Mono`, `Base Font Size`, `Border Radius`, `Spacing Scale`,
`Shadow / Elevation Style`, `Icon Library`, `UI Framework`, `Component Aesthetic`,
`Animation Style`, `Voice / Tone`, `Logo Asset Location`, `Imagery Style`,
`Accessibility Target`, `Notes`.

---

## The four list sheets

`requirements`, `pages`, `models` and `routes` are arrays of objects keyed by column name.
The placeholder row the template ships (`FR-001`, `PV-01`, `RT-001`, all blank) is
replaced by yours. Any column you omit comes out empty; **an unknown column is a hard
error**, so a typo can't silently vanish.

```json
{
  "requirements": [
    {
      "ID": "FR-001",
      "User Role": "walker",
      "Goal": "Create an account and sign in",
      "Reason (So That...)": "my walk records stay private to me",
      "Acceptance Criteria": "Sign-up with email + password creates a session; sign-out clears it",
      "Priority": "Required",
      "Related PV IDs": "PV-01; PV-02",
      "Related Route IDs": "RT-001",
      "Related Models": "User",
      "Status": "To Do"
    }
  ],
  "pages": [
    {
      "ID": "PV-01",
      "Page/View Name": "Sign in",
      "Route Path": "/login",
      "Access Level": "Public",
      "Purpose": "Let an existing walker back in",
      "Key Elements and Content": "Email field, password field, submit, link to sign up",
      "User Interactions": "Submit credentials",
      "Data Displayed (Models)": "None",
      "API Routes Used": "RT-001",
      "Navigates From": "Direct link",
      "Navigates To": "PV-03",
      "Related FR IDs": "FR-001"
    }
  ],
  "models": [
    {
      "Model Name": "Walk",
      "Field Name": "durationMinutes",
      "Type": "Number",
      "Description": "How long the walk lasted",
      "Sample Data": "35",
      "Required": "Yes",
      "Default Value": "",
      "Indexed": "No",
      "Unique": "No",
      "Sensitive": "No",
      "References (FK)": "",
      "Validation/Constraints": "1-600",
      "Notes": ""
    }
  ],
  "routes": [
    {
      "Route ID": "RT-002",
      "Action Name": "Create walk",
      "HTTP Method": "POST",
      "Endpoint Path": "/api/walks",
      "Auth Required": "Yes",
      "Related PV IDs": "PV-03",
      "Related FR IDs": "FR-002",
      "Input Parameters": "dog, startedAt, durationMinutes, notes",
      "Validation Rules": "dog must belong to the signed-in user",
      "Expected Output": "The created walk, in the success envelope",
      "Success Status Code": "201",
      "Error Cases": "401 unauthenticated; 400 validation; 404 unknown dog",
      "Database Interaction": "Walk.create",
      "Related Models": "Walk",
      "Side Effects": "None",
      "Notes": ""
    }
  ]
}
```

Column names, for reference:

| Sheet          | Columns                                                                                                                                                                                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `requirements` | `ID`, `User Role`, `Goal`, `Reason (So That...)`, `Acceptance Criteria`, `Priority`, `Related PV IDs`, `Related Route IDs`, `Related Models`, `Status`                                                                                                                             |
| `pages`        | `ID`, `Page/View Name`, `Route Path`, `Access Level`, `Purpose`, `Key Elements and Content`, `User Interactions`, `Data Displayed (Models)`, `API Routes Used`, `Navigates From`, `Navigates To`, `Related FR IDs`, `Notes`                                                        |
| `models`       | `Model Name`, `Field Name`, `Type`, `Description`, `Sample Data`, `Required`, `Default Value`, `Indexed`, `Unique`, `Sensitive`, `References (FK)`, `Validation/Constraints`, `Notes`                                                                                              |
| `routes`       | `Route ID`, `Action Name`, `HTTP Method`, `Endpoint Path`, `Auth Required`, `Related PV IDs`, `Related FR IDs`, `Input Parameters`, `Validation Rules`, `Expected Output`, `Success Status Code`, `Error Cases`, `Database Interaction`, `Related Models`, `Side Effects`, `Notes` |

---

## Conventions worth keeping

- **IDs**: `FR-001`, `PV-01`, `RT-001`, zero-padded, in the order a user meets them.
- **Multi-value cells**: semicolon-separated (`PV-01; PV-02`), or pass an array and let
  the script join it.
- **Cross-reference both ways.** If `FR-002` names `PV-03`, `PV-03` should name `FR-002`.
- **One row per field per model**, not one row per model.
- **Include what already exists** — the `User` model's fields and the template's seven
  routes. A sheet that only lists new work reads as if the rest doesn't exist.
- **Blank beats invented.** An empty `Key Differentiator` is honest; a fabricated one is a
  lie the next person has to discover.

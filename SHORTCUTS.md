# Apple Shortcuts — Sync GSD Inbox from Apple Reminders

Run on demand ("Hey Siri, sync my inbox") or add as an automation on a schedule.

---

## Setup

**Before you build the Shortcut, have these ready:**
- Your Worker URL: `https://gsd-worker.sbozzone.workers.dev`
- Your AUTH_TOKEN: (the token you set as a Cloudflare secret)
- A Reminders list named exactly: **GSD Inbox**

---

## Shortcut Actions (in order)

### 1. Get Reminders
| Field | Value |
|---|---|
| Action | **Find Reminders** |
| List | GSD Inbox |
| Filter | Is Completed: is false |
| Limit | Off |

> Variable name: `Reminders`

---

### 2. Set variable — Synced Count
| Field | Value |
|---|---|
| Action | **Set Variable** |
| Name | `SyncedCount` |
| Value | `0` |

---

### 3. Repeat with each item in Reminders

**Action: Repeat with Each**
Input: `Reminders`

---

#### 3a. Make the POST request
| Field | Value |
|---|---|
| Action | **Get Contents of URL** |
| URL | `https://gsd-worker.sbozzone.workers.dev/api/inbox` |
| Method | POST |
| Headers | `Content-Type` = `application/json` |
| Headers | `Authorization` = `Bearer YOUR_AUTH_TOKEN` |
| Request Body | JSON |
| **Allow Error Responses** | **On** ← required so 4xx responses are returned instead of crashing |

**JSON Body** (use the JSON body type in Shortcuts):
```json
{
  "text":         "Repeat Item · Title",
  "source":       "reminders",
  "reminders_id": "Repeat Item · Identifier"
}
```
> Tap each value field and insert the magic variable:
> - `text` → tap **Repeat Item** → **Title**
> - `reminders_id` → tap **Repeat Item** → **Identifier**

> Variable name: `APIResponse`

---

#### 3b. If the POST succeeded — mark reminder complete

Check whether the `data` key in the response has a value. This is more reliable than
checking `error` because JSON `null` values can behave inconsistently across iOS versions.

| Field | Value |
|---|---|
| Action | **If** |
| Input | `APIResponse` → **Dictionary** → Key: `data` |
| Condition | **has any value** |

**Inside the If block:**

**Action: Mark as Completed**
| Field | Value |
|---|---|
| Action | **Mark Reminders as Completed** |
| Reminders | `Repeat Item` |

**Action: Set variable — increment counter**
| Field | Value |
|---|---|
| Action | **Set Variable** |
| Name | `SyncedCount` |
| Value | `SyncedCount` + `1` *(use Calculate action: SyncedCount + 1)* |

**Otherwise** (sync failed — show which item failed):

**Action: Show Notification**
| Field | Value |
|---|---|
| Action | **Show Notification** |
| Title | `GSD Sync Failed` |
| Body | `Could not sync: ` + `Repeat Item · Title` |

> This makes auth or network failures visible so you know what went wrong.

---

#### 3c. End Repeat

---

### 4. Show notification
| Field | Value |
|---|---|
| Action | **Show Notification** |
| Title | `GSD Inbox` |
| Body | `Synced ` + `SyncedCount` + ` items to GSD inbox` |

---

## Adding a Schedule (optional)

1. Open **Automations** tab in Shortcuts
2. Tap **+** → **Time of Day**
3. Set time (e.g. 7:00 AM, daily)
4. Choose **Run Immediately** (no confirmation)
5. Select your GSD Sync shortcut

---

## Troubleshooting

### Items not appearing in GSD after running the Shortcut

1. **Check the sync notification** — it shows how many items were synced. If it says `0`, the
   Shortcut ran but all POSTs failed. If you see "GSD Sync Failed" alerts, auth or network is
   the issue.

2. **Verify your AUTH_TOKEN** — the token in the Shortcut header must exactly match the
   Cloudflare secret. Test connectivity:
   ```
   curl -X POST https://gsd-worker.sbozzone.workers.dev/api/inbox \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{"text":"test item","source":"reminders","reminders_id":"test-123"}'
   ```
   A 401 response means the token is wrong.

3. **Confirm the Reminders list name** — it must be named exactly `GSD Inbox`
   (case-sensitive, no extra spaces).

4. **Refresh the GSD app** — after the Shortcut runs, open the GSD app and go to the
   Triage tab. Tap the **↻ Sync** button to pull the latest inbox items, or simply reload
   the page. The app also auto-refreshes whenever you switch back to the browser tab.

5. **Check "Allow Error Responses"** — in the "Get Contents of URL" action, make sure
   "Allow Error Responses" is turned **On**. Without this, a 401 response crashes the
   Shortcut silently and nothing syncs.

---

## Notes

- The `reminders_id` field uses Apple's internal Reminder identifier to prevent duplicate
  imports if the Shortcut runs twice before you triage.
- The Worker returns the existing inbox record (not an error) if a reminder was already
  imported — so the Shortcut correctly marks it complete on the second run too.
- Completed reminders stay in your Reminders app history; they just won't re-import.

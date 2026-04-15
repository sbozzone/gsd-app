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
| Field | Value |
|---|---|
| Action | **If** |
| Input | `APIResponse` → **Dictionary** → Key: `error` |
| Condition | is null / does not have value |

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

**Otherwise** (End If): do nothing — item stays incomplete, no duplicate.

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

## Notes

- The `reminders_id` field uses Apple's internal Reminder identifier to prevent duplicate imports if the Shortcut runs twice before you triage.
- The Worker returns the existing inbox record (not an error) if a reminder was already imported — so the Shortcut correctly marks it complete on the second run too.
- Completed reminders stay in your Reminders app history; they just won't re-import.

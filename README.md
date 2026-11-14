# ARC Lab Dashboard

Private web dashboard for the ARC-LAB Google Sheet. It has two kinds of page:

- **Dashboard:** status of every machine plus utilization charts (hours, revenue, students).
- **Machine page:** opens when you click a machine. It shows the machine's details, utilization, monthly usage, maintenance history (from that machine's own sheet) and recent usage.

The data is read live from the sheets. Only the account that deploys it can open it.
An open page reloads its data automatically every 5 minutes (`AUTO_MIN` in `Index.html`), and again whenever you return to the tab.

**Live deployment:** Apps Script project "ARC Lab Dashboard", owned by the ARC admin Google account, with access set to "Only myself".

## Files
| File | Purpose |
|---|---|
| `Code.gs` | Reads the sheets and returns the data |
| `Index.html` | The web page (white theme) |

## Setup (one time, about 5 minutes)
1. Open the **ARC-LAB** sheet, then **Extensions → Apps Script**.
2. In the editor, replace everything in `Code.gs` with this repo's `Code.gs`.
3. Click **+ → HTML**, name it `Index` (exactly, without `.html`) and paste in `Index.html`.
4. Click **Save**.
5. Click **Deploy → New deployment**, then the gear icon, then **Web app**:
   - Description: `ARC Lab Dashboard`
   - Execute as: **Me**
   - Who has access: **Only myself**
6. Click **Deploy**, then **Authorize access**, and allow it to read your sheets.
7. Copy the **Web app URL** and bookmark it. That URL is your dashboard.

## Updating later
After you change the code: **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**. The URL stays the same.

## Colour rules
| Colour | Meaning |
|---|---|
| Green | Used within the last 7 days |
| Blue | Idle 7–13 days |
| Orange | Idle 14+ days (check status) |
| Red | The machine card's Status cell says "Not Working", or the machine is outdated and has no summary row |

## Notes
- Phone and roll numbers from the usage log are not shown. The student in charge's phone number from the machine card is shown on that machine's page.
- Usage log dates are typed DD/MM/YYYY. The script reads both the text dates and the dates that Sheets converted the wrong way round.
- Old log entries named `A1 3D PRINTER (E-YANTRA)` are counted as **E-Yantra A1**.
- If you add a new machine, add its card to the next free card slot in the sheet and its row to the summary table (W5:W14).

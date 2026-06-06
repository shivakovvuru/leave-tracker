# 👤 User Guide

End-to-end walk-through of the Leave Tracker for both admins and members.

---

## Sign in / sign up

- Open the app URL in your browser.
- If you don't have an account yet, click **Create an account** on the login page and fill in your name, email, and a password (min 6 chars). The admin must approve you before you can log in.
- Demo accounts after first boot:

  | Role   | Email                | Password    |
  |--------|----------------------|-------------|
  | Admin  | admin@company.com    | admin123    |
  | Member | aarav@company.com    | member123   |

- The first thing the **admin** should do after first login is go to **My Profile** and change the demo password.

---

## Common to both roles

### My Profile
- Edit your **First Name**, **Last Name**, and **Mobile** number.
- **Email is fixed** — it identifies your account and is shown to admins.
- **Change Password**: enter your current password, choose a new one, confirm it. As soon as the change succeeds, the server invalidates all your active sessions and the UI bounces you to the login screen. Sign back in with the new password.

### Bell notifications
- The bell icon in the top-right shows a count of unread notifications.
- Click the bell to see the list:
  - **submitted** — appears for admins when a member applies for leave.
  - **approved** / **rejected** — appears for the member whose leave was decided.
  - **changed** — appears for admins when a member edits an already-approved leave.
  - **cancelled** — appears for both sides on cancel.
- Clicking a notification marks it as read and drops the count by one. Clicking **Mark all read** clears the badge.

### Calendar
- Year / Month / Week views.
- The year dropdown only lists **active** fiscal years. Ask your admin to activate a year in **Years** if you don't see the one you need.
- Click any **weekday** cell to apply for leave on that date. Weekends are non-clickable (with a tooltip explaining why).
- New leave can only be applied between **today** and **today + 90 days**.
- The Leave Records table below the calendar supports approve / reject / cancel / delete actions depending on your role.

---

## Member workflow

### Apply for leave
1. **My Leaves** → **Apply Leave**.
2. Pick **From** and **To** (the date inputs already enforce today..today+90 days).
3. Pick the leave type: **PL (Planned Leave)**, **Sick Leave**, or **Unplanned Leave**.
4. Optionally add a reason.
5. **Submit**. The status is **Pending** until your admin acts.

### Edit or cancel your own leave
- **My Leaves** shows Upcoming, Rejected, and Past sections.
- Click the pencil icon on a **Pending** row to request a change. For **Approved** leaves, the edit is sent to your admin for approval.
- Click the trash icon on a **Pending** row to cancel it. Approved leaves can only be cancelled by an admin.

### My Dashboard
- Your project name, project members, your upcoming and pending leave count, and your team's plans.

### Validation rules you'll see
- "Cannot apply leave for past dates."
- "Cannot apply leave more than 3 months in advance (max YYYY-MM-DD)."
- "Leaves cannot be applied on weekends (Saturday / Sunday). Pick a weekday."
- "Overlaps an existing Pending/Approved leave (…). Cancel or adjust that leave first."

---

## Admin workflow

### Dashboard
- The **Project Snapshot** card is your drill-down: pick a project from the dropdown (defaults to the alphabetically-first project) and every tile on the page — KPIs, today's attendance, pie charts, slice details, the project-detail table — filters to that project. Switch the dropdown to change.
- Click a slice in the **Leave Distribution by Type** pie to see a member-by-member breakdown in the table below.

### Projects
- Create / edit / delete projects, set start & end dates and a status.
- Click **Manage Team** on a project card to see its members, edit their role/project, or remove them.

### Members
- The list shows every team member with their name, role, project, **mobile number**, and join date.
- Approve or reject new signups in the **Pending Sign-ups** card. Approving creates a member row that you can then assign a role/project to.
- Add a new role under **New Role** to grow your role taxonomy.

### Approvals
Three sections:
1. **Pending Leave Submissions** — every leave in `Pending` status. Click **Approve** or **Reject** directly.
2. **Pending Changes to Approved Leaves** — when a member edits an approved leave, the change shows up here.
3. **Recently Decided** — your last 10 approve/reject decisions for quick reference.

### Years
- Activate / deactivate fiscal years. Inactive years are hidden from the calendar year dropdown and from the leave-create form (the server rejects any leave whose start date falls in an inactive year).
- The system seeds the current year and next year automatically on first boot.

### Holidays
- Add or remove company-wide public holidays. They are auto-applied to all calendars and reports.

### Reports
- Pick a year and a project scope. See monthly leave trend (line), leave-type distribution (pie), per-member stacked bar, and a member summary table with total days and remaining quota.
- **Export CSV** downloads the summary.

---

## Quick troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| "Account pending admin approval" on login | New signup not yet approved | Admin → Members → Pending Sign-ups → Approve |
| Calendar year dropdown empty | No active fiscal year | Admin → Years → Activate a year |
| Apply Leave blocked on a date you think is valid | Past date, weekend, or > 90 days out | Pick a future weekday within the next 90 days |
| "Overlaps an existing leave" | You already have a Pending/Approved leave covering that range | Cancel the overlapping leave first (admin can cancel Approved) |
| Password change immediately logged you out | Working as designed | Sign in with the new password |

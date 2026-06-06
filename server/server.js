// Express server for the Leave Tracker app — auth + RBAC + dynamic years
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { init, hashPassword, verifyPassword, makeToken } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ---------- helpers ----------
// Use local-time Date objects throughout so day-of-week is correct
// regardless of the server's timezone offset.
const isWeekend = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  return day === 0 || day === 6;
};
const calculateWorkingDays = (start, end) => {
  let count = 0;
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  // Iterate by day-of-month using the local Date directly (not via toISOString)
  for (let d = new Date(s); d.getTime() <= e.getTime(); d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
};

// Allowed leave types
const LEAVE_TYPES = ['PL', 'Sick Leave', 'Unplanned Leave'];
const LEAVE_STATUSES = ['Pending', 'Approved', 'Rejected'];

// ---------- auth middleware ----------
function authRequired(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  const session = db.get('SELECT * FROM sessions WHERE token = ?', [token]);
  if (!session) return res.status(401).json({ error: 'Invalid session' });
  const user = db.get('SELECT id, email, role, name, first_name, last_name, mobile, approved FROM users WHERE id = ?', [session.user_id]);
  if (!user) return res.status(401).json({ error: 'User not found' });
  req.user = user;
  next();
}
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}
function approvedOnly(req, res, next) {
  if (!req.user.approved) return res.status(403).json({ error: 'Account pending admin approval' });
  next();
}

// Resolve the member profile linked to this user (if any)
function memberForUser(userId) {
  if (!userId) return null;
  return db.get(`
    SELECT m.*, u.first_name, u.last_name, u.mobile
    FROM members m
    LEFT JOIN users u ON u.id = m.user_id
    WHERE m.user_id = ?
  `, [userId]);
}

let db;
async function start() {
  db = await init();

  // ===== Health =====
  app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

  // ===== Auth =====
  app.post('/api/auth/signup', (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'email, password and name are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const existing = db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing) return res.status(400).json({ error: 'Email already registered' });
    const { salt, hash } = hashPassword(password);
    const parts = name.trim().split(/\s+/);
    const first = parts[0] || '';
    const last  = parts.slice(1).join(' ') || '';
    db.run(
      `INSERT INTO users (email, password_hash, password_salt, role, name, first_name, last_name, approved) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [email.toLowerCase(), hash, salt, 'member', name, first, last, 0]
    );
    const userId = db.lastInsertRowid('users');
    res.json({ id: userId, message: 'Account created. Please wait for admin approval before logging in.' });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
    const user = db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    if (!verifyPassword(password, user.password_salt, user.password_hash))
      return res.status(401).json({ error: 'Invalid email or password' });
    if (!user.approved) return res.status(403).json({ error: 'Account pending admin approval' });
    const token = makeToken();
    db.run('INSERT INTO sessions (token, user_id) VALUES (?, ?)', [token, user.id]);
    const member = memberForUser(user.id);
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name,
              first_name: user.first_name, last_name: user.last_name, mobile: user.mobile,
              role: user.role, approved: !!user.approved },
      member: member || null,
    });
  });

  app.post('/api/auth/logout', authRequired, (req, res) => {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (token) db.run('DELETE FROM sessions WHERE token = ?', [token]);
    res.json({ success: true });
  });

  app.get('/api/auth/me', authRequired, (req, res) => {
    const member = memberForUser(req.user.id);
    res.json({ user: req.user, member: member || null });
  });

  // Update current user's profile (name fields + mobile + optional password change)
  app.put('/api/auth/profile', authRequired, (req, res) => {
    const { first_name, last_name, mobile, current_password, new_password } = req.body || {};
    const u = db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!u) return res.status(404).json({ error: 'User not found' });

    // Password change requires the current password
    let passwordChanged = false;
    if (new_password) {
      if (!current_password) return res.status(400).json({ error: 'Current password is required to change password' });
      if (new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
      if (!verifyPassword(current_password, u.password_salt, u.password_hash)) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      const { salt, hash } = hashPassword(new_password);
      db.run('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?', [hash, salt, u.id]);
      passwordChanged = true;
    }

    const nextFirst = first_name !== undefined ? first_name : u.first_name;
    const nextLast  = last_name  !== undefined ? last_name  : u.last_name;
    const nextMob   = mobile      !== undefined ? mobile      : u.mobile;
    const composedName = `${(nextFirst || '').trim()} ${(nextLast || '').trim()}`.trim() || u.name;
    db.run('UPDATE users SET first_name = ?, last_name = ?, mobile = ?, name = ? WHERE id = ?',
           [nextFirst, nextLast, nextMob, composedName, u.id]);

    // If password changed, kill all sessions for this user (force re-login)
    if (passwordChanged) {
      db.run('DELETE FROM sessions WHERE user_id = ?', [u.id]);
    }

    const fresh = db.get('SELECT id, email, role, name, first_name, last_name, mobile, approved FROM users WHERE id = ?', [u.id]);
    res.json({ user: fresh, passwordChanged });
  });

  // Admin: list pending user approvals
  app.get('/api/auth/pending-users', authRequired, adminOnly, (req, res) => {
    res.json(db.all('SELECT id, email, name, created_at FROM users WHERE approved = 0 AND role = ?', ['member']));
  });
  app.post('/api/auth/approve/:id', authRequired, adminOnly, (req, res) => {
    const id = Number(req.params.id);
    const u = db.get('SELECT id, email, name, approved FROM users WHERE id = ? AND role = ?', [id, 'member']);
    if (!u) return res.status(404).json({ error: 'User not found' });
    if (u.approved) return res.json({ success: true, alreadyApproved: true });
    // Mark user as approved
    db.run('UPDATE users SET approved = 1 WHERE id = ?', [id]);
    // Create a members row so the user shows up in the Members page.
    // role_id and project_id are left null — admin assigns them from the Members page.
    // The unique constraint on members.email would conflict if the admin
    // had already created a stub member earlier, so guard for that.
    const existingMember = db.get('SELECT id FROM members WHERE email = ?', [u.email]);
    let memberId = existingMember ? existingMember.id : null;
    if (!existingMember) {
      db.run(
        'INSERT INTO members (user_id, name, email) VALUES (?, ?, ?)',
        [u.id, u.name, u.email]
      );
      memberId = db.lastInsertRowid('members');
    } else if (!existingMember.user_id) {
      // Link an existing stub member to this user
      db.run('UPDATE members SET user_id = ? WHERE id = ?', [u.id, existingMember.id]);
    }
    res.json({ success: true, memberId });
  });
  app.post('/api/auth/reject/:id', authRequired, adminOnly, (req, res) => {
    db.run('DELETE FROM users WHERE id = ? AND role = ? AND approved = 0', [req.params.id, 'member']);
    res.json({ success: true });
  });

  // ===== Notifications =====
  function notifyAllAdmins(kind, message, leaveId) {
    const admins = db.all("SELECT id FROM users WHERE role = 'admin'");
    for (const a of admins) {
      db.run('INSERT INTO notifications (user_id, kind, message, leave_id) VALUES (?, ?, ?, ?)',
             [a.id, kind, message, leaveId || null]);
    }
  }
  function notifyUser(userId, kind, message, leaveId) {
    if (!userId) return;
    db.run('INSERT INTO notifications (user_id, kind, message, leave_id) VALUES (?, ?, ?, ?)',
           [userId, kind, message, leaveId || null]);
  }

  app.get('/api/notifications', authRequired, (req, res) => {
    const items = db.all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [req.user.id]);
    const unread = db.get('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0', [req.user.id]).c;
    res.json({ items, unread });
  });

  app.post('/api/notifications/mark-read', authRequired, (req, res) => {
    db.run('UPDATE notifications SET read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ success: true });
  });

  app.post('/api/notifications/:id/read', authRequired, (req, res) => {
    db.run('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  });

  // ===== Fiscal Years =====
  app.get('/api/years', authRequired, (req, res) => {
    res.json(db.all('SELECT * FROM fiscal_years ORDER BY year DESC'));
  });
  app.post('/api/years', authRequired, adminOnly, (req, res) => {
    const { year, label } = req.body;
    if (!year) return res.status(400).json({ error: 'year is required' });
    const existing = db.get('SELECT id FROM fiscal_years WHERE year = ?', [year]);
    if (existing) return res.status(400).json({ error: 'Year already exists' });
    db.run('INSERT INTO fiscal_years (year, label, active) VALUES (?, ?, ?)', [year, label || `FY ${year}`, 1]);
    res.json({ id: db.lastInsertRowid('fiscal_years') });
  });
  app.put('/api/years/:id', authRequired, adminOnly, (req, res) => {
    const { active, label } = req.body;
    const cur = db.get('SELECT * FROM fiscal_years WHERE id = ?', [req.params.id]);
    if (!cur) return res.status(404).json({ error: 'Not found' });
    db.run('UPDATE fiscal_years SET active = ?, label = ? WHERE id = ?',
           [active === undefined ? cur.active : (active ? 1 : 0), label ?? cur.label, req.params.id]);
    res.json({ success: true });
  });
  app.delete('/api/years/:id', authRequired, adminOnly, (req, res) => {
    db.run('DELETE FROM fiscal_years WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  // ===== Roles =====
  app.get('/api/roles', authRequired, (req, res) => res.json(db.all('SELECT * FROM roles ORDER BY name')));
  app.post('/api/roles', authRequired, adminOnly, (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Role name is required' });
    try { db.run('INSERT INTO roles (name) VALUES (?)', [name]); res.json({ id: db.lastInsertRowid('roles'), name }); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.delete('/api/roles/:id', authRequired, adminOnly, (req, res) => {
    db.run('DELETE FROM roles WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  // ===== Projects =====
  app.get('/api/projects', authRequired, approvedOnly, (req, res) => {
    if (req.user.role === 'admin') {
      const rows = db.all(`
        SELECT p.*, (SELECT COUNT(*) FROM members m WHERE m.project_id = p.id) AS member_count
        FROM projects p ORDER BY p.created_at DESC`);
      return res.json(rows);
    }
    // member: only their tagged project
    const member = memberForUser(req.user.id);
    if (!member || !member.project_id) return res.json([]);
    const rows = db.all(`
      SELECT p.*, (SELECT COUNT(*) FROM members m WHERE m.project_id = p.id) AS member_count
      FROM projects p WHERE p.id = ?`, [member.project_id]);
    res.json(rows);
  });

  app.get('/api/projects/:id', authRequired, approvedOnly, (req, res) => {
    const project = db.get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    // member can only view their own project
    if (req.user.role !== 'admin') {
      const member = memberForUser(req.user.id);
      if (!member || member.project_id !== project.id) return res.status(403).json({ error: 'Forbidden' });
    }
    const members = db.all(`
      SELECT m.id, m.name, m.email, m.avatar, m.join_date, m.user_id, r.name AS role_name
      FROM members m LEFT JOIN roles r ON m.role_id = r.id
      WHERE m.project_id = ? ORDER BY m.name`, [req.params.id]);
    res.json({ ...project, members });
  });

  app.post('/api/projects', authRequired, adminOnly, (req, res) => {
    const { name, code, description, start_date, end_date, status } = req.body;
    if (!name) return res.status(400).json({ error: 'Project name is required' });
    try {
      db.run(`INSERT INTO projects (name, code, description, start_date, end_date, status)
              VALUES (?, ?, ?, ?, ?, ?)`,
             [name, code || null, description || null, start_date || null, end_date || null, status || 'Active']);
      res.json({ id: db.lastInsertRowid('projects') });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  app.put('/api/projects/:id', authRequired, adminOnly, (req, res) => {
    const cur = db.get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (!cur) return res.status(404).json({ error: 'Not found' });
    const { name, code, description, start_date, end_date, status } = req.body;
    db.run(`UPDATE projects
            SET name=?, code=?, description=?, start_date=?, end_date=?, status=?
            WHERE id = ?`,
           [name ?? cur.name, code ?? cur.code, description ?? cur.description,
            start_date ?? cur.start_date, end_date ?? cur.end_date, status ?? cur.status,
            req.params.id]);
    res.json({ success: true });
  });

  app.delete('/api/projects/:id', authRequired, adminOnly, (req, res) => {
    db.run('DELETE FROM projects WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  // ===== Members =====
  // Admin: all members; Member: only members in their own project
  app.get('/api/members', authRequired, approvedOnly, (req, res) => {
    const base = `
      SELECT m.*, r.name AS role_name, p.name AS project_name,
             u.first_name, u.last_name, u.mobile
      FROM members m
      LEFT JOIN roles r ON m.role_id = r.id
      LEFT JOIN projects p ON m.project_id = p.id
      LEFT JOIN users u ON u.id = m.user_id`;
    if (req.user.role === 'admin') {
      const { project_id } = req.query;
      return res.json(project_id
        ? db.all(base + ' WHERE m.project_id = ? ORDER BY m.name', [project_id])
        : db.all(base + ' ORDER BY m.name'));
    }
    const me = memberForUser(req.user.id);
    if (!me || !me.project_id) return res.json([]);
    res.json(db.all(base + ' WHERE m.project_id = ? ORDER BY m.name', [me.project_id]));
  });

  app.post('/api/members', authRequired, adminOnly, (req, res) => {
    const { name, email, role_id, project_id, join_date, avatar, user_id } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });
    try {
      db.run(`INSERT INTO members (name, email, role_id, project_id, join_date, avatar, user_id)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
             [name, email, role_id || null, project_id || null, join_date || null,
              avatar || null, user_id || null]);
      res.json({ id: db.lastInsertRowid('members') });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  app.put('/api/members/:id', authRequired, adminOnly, (req, res) => {
    const cur = db.get('SELECT * FROM members WHERE id = ?', [req.params.id]);
    if (!cur) return res.status(404).json({ error: 'Not found' });
    const { name, email, role_id, project_id, join_date, avatar, user_id, mobile } = req.body;
    db.run(`UPDATE members SET
            name=?, email=?, role_id=?, project_id=?, join_date=?, avatar=?, user_id=?
            WHERE id = ?`,
           [name ?? cur.name, email ?? cur.email, role_id ?? cur.role_id,
            project_id ?? cur.project_id, join_date ?? cur.join_date,
            avatar ?? cur.avatar, user_id ?? cur.user_id, req.params.id]);

    // Mobile lives on users. Only update it if explicitly provided AND a user is linked.
    if (mobile !== undefined) {
      const linkedUserId = (user_id ?? cur.user_id);
      if (linkedUserId) {
        db.run('UPDATE users SET mobile = ? WHERE id = ?', [mobile || null, linkedUserId]);
      }
    }
    res.json({ success: true });
  });

  app.delete('/api/members/:id', authRequired, adminOnly, (req, res) => {
    db.run('DELETE FROM members WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  // ===== Leaves =====
  // Returns a 400-style error object or null if the proposed leave is OK.
  // ignoreId lets the caller skip a row (e.g. when updating the same leave).
  function validateLeaveChange(memberId, start_date, end_date, ignoreId) {
    if (start_date > end_date) return { error: 'start_date cannot be after end_date' };
    const todayStr = new Date().toISOString().slice(0, 10);
    const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + 90);
    const maxStr = maxDate.toISOString().slice(0, 10);
    if (start_date < todayStr) return { error: 'Cannot apply leave for past dates.' };
    if (start_date > maxStr)   return { error: `Cannot apply leave more than 3 months in advance (max ${maxStr}).` };
    if (end_date   > maxStr)   return { error: `Cannot apply leave more than 3 months in advance (max ${maxStr}).` };
    if (calculateWorkingDays(start_date, end_date) <= 0) {
      return { error: 'Selected range has no working days (entirely weekends). Pick a weekday.' };
    }
    const overlap = db.get(`
      SELECT id, leave_type, start_date, end_date, status FROM leaves
      WHERE member_id = ?
        AND status != 'Rejected'
        AND (? IS NULL OR id != ?)
        AND NOT (end_date < ? OR start_date > ?)
      LIMIT 1
    `, [memberId, ignoreId, ignoreId, start_date, end_date]);
    if (overlap) {
      return {
        error: `Overlaps an existing ${overlap.status} leave (${overlap.start_date} → ${overlap.end_date}, ${overlap.leave_type}). Cancel or adjust that leave first.`,
        conflictId: overlap.id,
      };
    }
    return null;
  }

  app.get('/api/leaves', authRequired, approvedOnly, (req, res) => {
    const { member_id, project_id, start, end, leave_type, status } = req.query;
    let sql = `
      SELECT l.*, m.name AS member_name, m.email AS member_email,
             r.name AS role_name, p.name AS project_name
      FROM leaves l
      LEFT JOIN members m ON l.member_id = m.id
      LEFT JOIN roles r ON m.role_id = r.id
      LEFT JOIN projects p ON l.project_id = p.id
      WHERE 1=1`;
    const params = [];

    if (req.user.role !== 'admin') {
      // member: only own leaves + project teammates' leaves
      const me = memberForUser(req.user.id);
      if (!me) return res.json([]);
      if (me.project_id) {
        sql += ' AND (l.member_id = ? OR l.project_id = ?)';
        params.push(me.id, me.project_id);
      } else {
        sql += ' AND l.member_id = ?';
        params.push(me.id);
      }
    }
    if (member_id)  { sql += ' AND l.member_id = ?';  params.push(member_id); }
    if (project_id) { sql += ' AND l.project_id = ?'; params.push(project_id); }
    if (start)      { sql += ' AND l.start_date >= ?'; params.push(start); }
    if (end)        { sql += ' AND l.end_date <= ?';   params.push(end); }
    if (leave_type) { sql += ' AND l.leave_type = ?';  params.push(leave_type); }
    if (status)     { sql += ' AND l.status = ?';      params.push(status); }
    sql += ' ORDER BY l.start_date DESC';
    res.json(db.all(sql, ...params));
  });

  app.post('/api/leaves', authRequired, approvedOnly, (req, res) => {
    // Member can only create leaves for themselves
    let { member_id, project_id, leave_type, start_date, end_date, reason, status } = req.body;
    if (!LEAVE_TYPES.includes(leave_type)) return res.status(400).json({ error: 'Invalid leave type' });
    if (!start_date || !end_date) return res.status(400).json({ error: 'start_date and end_date are required' });

    if (req.user.role !== 'admin') {
      const me = memberForUser(req.user.id);
      if (!me) return res.status(403).json({ error: 'No member profile linked' });
      member_id = me.id;
      project_id = me.project_id;
    }
    if (!member_id) return res.status(400).json({ error: 'member_id is required' });

    // Active fiscal year (still inline — depends on the data, not the date range)
    const startYear = Number(start_date.slice(0, 4));
    const endYear   = Number(end_date.slice(0, 4));
    const activeYears = db.all('SELECT year FROM fiscal_years WHERE active = 1').map(r => r.year);
    if (activeYears.length === 0) return res.status(400).json({ error: 'No active fiscal year. Ask admin to activate one.' });
    if (!activeYears.includes(startYear) || (startYear !== endYear && !activeYears.includes(endYear))) {
      return res.status(400).json({ error: `Leaves can only be created in an active fiscal year (${activeYears.join(', ')}).` });
    }

    // Date window, working-day sanity, and overlap check (shared with PUT)
    const v = validateLeaveChange(member_id, start_date, end_date, null);
    if (v) return res.status(400).json(v);
    const days = calculateWorkingDays(start_date, end_date);

    // Members submit as 'Pending', admins default 'Approved'
    const finalStatus = req.user.role === 'admin' ? (status || 'Approved') : 'Pending';
    try {
      db.run(`INSERT INTO leaves (member_id, project_id, leave_type, start_date, end_date, days, reason, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
             [member_id, project_id || null, leave_type, start_date, end_date, days,
              reason || null, finalStatus]);
      const newLeaveId = db.lastInsertRowid('leaves');
      const member = db.get('SELECT name FROM members WHERE id = ?', [member_id]);
      const memberName = member?.name || 'A member';
      if (req.user.role === 'admin') {
        // Admin created it — no notification needed (their own action).
      } else {
        // Member submitted — notify all admins
        notifyAllAdmins('leave_submitted', `${memberName} applied for ${leave_type} (${start_date} → ${end_date})`, newLeaveId);
      }
      res.json({ id: newLeaveId, days, status: finalStatus });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  // PUT leave: admin = direct update; member = submit pending update for approval
  app.put('/api/leaves/:id', authRequired, approvedOnly, (req, res) => {
    const cur = db.get('SELECT * FROM leaves WHERE id = ?', [req.params.id]);
    if (!cur) return res.status(404).json({ error: 'Not found' });
    const { leave_type, start_date, end_date, reason, status, action } = req.body;

    // Cancel: members can cancel their own Pending leaves; admins can cancel any
    if (action === 'cancel') {
      if (req.user.role !== 'admin') {
        const me = memberForUser(req.user.id);
        if (!me || cur.member_id !== me.id) return res.status(403).json({ error: 'You can only cancel your own leaves' });
        if (cur.status !== 'Pending') return res.status(400).json({ error: 'Members can only cancel Pending leaves. Ask your admin to cancel an approved leave.' });
      }
      db.run('DELETE FROM leaves WHERE id = ?', [req.params.id]);
      const member = db.get('SELECT name, user_id FROM members WHERE id = ?', [cur.member_id]);
      const memberName = member?.name || 'A member';
      if (req.user.role === 'admin') {
        // Admin cancelled: notify the member (and other admins)
        if (member?.user_id) notifyUser(member.user_id, 'leave_cancelled', `Your ${cur.leave_type} leave (${cur.start_date} → ${cur.end_date}) was cancelled by admin.`, null);
        notifyAllAdmins('leave_cancelled', `${memberName}'s ${cur.leave_type} leave (${cur.start_date} → ${cur.end_date}) was cancelled.`, null);
      } else {
        // Member cancelled their own pending leave
        notifyAllAdmins('leave_cancelled', `${memberName} cancelled their ${cur.leave_type} leave (${cur.start_date} → ${cur.end_date}).`, null);
      }
      return res.json({ success: true, cancelled: true });
    }

    if (req.user.role !== 'admin') {
      const me = memberForUser(req.user.id);
      if (!me || cur.member_id !== me.id) return res.status(403).json({ error: 'You can only update your own leaves' });
      if (cur.status === 'Approved' || cur.pending_update) {
        // Submit as pending update for admin approval
        const proposed = {
          leave_type: leave_type ?? cur.leave_type,
          start_date: start_date ?? cur.start_date,
          end_date:   end_date   ?? cur.end_date,
          reason:     reason     ?? cur.reason,
        };
        db.run(`UPDATE leaves SET pending_update = 1, pending_data = ? WHERE id = ?`,
               [JSON.stringify(proposed), req.params.id]);
        const member = db.get('SELECT name FROM members WHERE id = ?', [cur.member_id]);
        notifyAllAdmins('leave_changed', `${member?.name || 'A member'} requested changes to their ${cur.leave_type} leave.`, cur.id);
        return res.json({ success: true, pending: true });
      }
      // Pending leave — member can update directly
      const start = start_date ?? cur.start_date;
      const end   = end_date   ?? cur.end_date;
      if (start_date || end_date) {
        const v = validateLeaveChange(me.id, start, end, cur.id);
        if (v) return res.status(400).json(v);
      }
      const days  = (start_date || end_date) ? calculateWorkingDays(start, end) : cur.days;
      db.run(`UPDATE leaves SET
              leave_type=?, start_date=?, end_date=?, days=?, reason=?
              WHERE id = ?`,
             [leave_type ?? cur.leave_type, start, end, days,
              reason ?? cur.reason, req.params.id]);
      return res.json({ success: true });
    }

    // admin
    if (action === 'approve_pending') {
      if (!cur.pending_data) return res.status(400).json({ error: 'No pending update' });
      const p = JSON.parse(cur.pending_data);
      const v = validateLeaveChange(cur.member_id, p.start_date, p.end_date, cur.id);
      if (v) return res.status(400).json(v);
      const days = calculateWorkingDays(p.start_date, p.end_date);
      db.run(`UPDATE leaves SET
              leave_type=?, start_date=?, end_date=?, days=?, reason=?, pending_update=0, pending_data=NULL
              WHERE id = ?`,
             [p.leave_type, p.start_date, p.end_date, days, p.reason, req.params.id]);
      const member = db.get('SELECT name, user_id FROM members WHERE id = ?', [cur.member_id]);
      if (member?.user_id) {
        notifyUser(member.user_id, 'leave_approved', `Your ${p.leave_type} leave change (${p.start_date} → ${p.end_date}) was approved.`, cur.id);
      }
      return res.json({ success: true, approved: true });
    }
    if (action === 'reject_pending') {
      db.run(`UPDATE leaves SET pending_update = 0, pending_data = NULL WHERE id = ?`, [req.params.id]);
      const member = db.get('SELECT name, user_id FROM members WHERE id = ?', [cur.member_id]);
      if (member?.user_id) {
        notifyUser(member.user_id, 'leave_rejected', `Your ${cur.leave_type} leave change was rejected.`, cur.id);
      }
      return res.json({ success: true, rejected: true });
    }

    const start = start_date ?? cur.start_date;
    const end   = end_date   ?? cur.end_date;
    if (start_date || end_date) {
      const v = validateLeaveChange(cur.member_id, start, end, cur.id);
      if (v) return res.status(400).json(v);
    }
    const days  = (start_date || end_date) ? calculateWorkingDays(start, end) : cur.days;
    const newStatus = status ?? cur.status;
    db.run(`UPDATE leaves SET
            leave_type=?, start_date=?, end_date=?, days=?, reason=?, status=?
            WHERE id = ?`,
           [leave_type ?? cur.leave_type, start, end, days,
            reason ?? cur.reason, newStatus, req.params.id]);

    // If admin changes status from Pending → Approved/Rejected, notify the member
    if (status && status !== cur.status) {
      const member = db.get('SELECT name, user_id FROM members WHERE id = ?', [cur.member_id]);
      if (member?.user_id) {
        if (status === 'Approved') {
          notifyUser(member.user_id, 'leave_approved', `Your ${leave_type ?? cur.leave_type} leave (${start} → ${end}) was approved.`, cur.id);
        } else if (status === 'Rejected') {
          notifyUser(member.user_id, 'leave_rejected', `Your ${leave_type ?? cur.leave_type} leave (${start} → ${end}) was rejected.`, cur.id);
        }
      }
    }
    res.json({ success: true });
  });

  // DELETE: admin only
  app.delete('/api/leaves/:id', authRequired, adminOnly, (req, res) => {
    db.run('DELETE FROM leaves WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  // ===== Public Holidays =====
  app.get('/api/holidays', authRequired, (req, res) => {
    const { fiscal_year_id, year } = req.query;
    if (year && !fiscal_year_id) {
      const fy = db.get('SELECT id FROM fiscal_years WHERE year = ?', [Number(year)]);
      if (!fy) return res.json([]);
      return res.json(db.all('SELECT * FROM public_holidays WHERE fiscal_year_id = ? ORDER BY date', [fy.id]));
    }
    res.json(db.all('SELECT * FROM public_holidays ORDER BY date'));
  });
  app.post('/api/holidays', authRequired, adminOnly, (req, res) => {
    const { date, name, fiscal_year_id } = req.body;
    if (!date || !name) return res.status(400).json({ error: 'date and name required' });
    try {
      db.run('INSERT INTO public_holidays (date, name, fiscal_year_id) VALUES (?, ?, ?)',
             [date, name, fiscal_year_id || null]);
      res.json({ id: db.lastInsertRowid('public_holidays') });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.delete('/api/holidays/:id', authRequired, adminOnly, (req, res) => {
    db.run('DELETE FROM public_holidays WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  // ===== Reports =====
  app.get('/api/reports/summary', authRequired, adminOnly, (req, res) => {
    const { project_id, year } = req.query;
    const y = year || new Date().getFullYear();
    const params = [`${y}-01-01`, `${y}-12-31`];
    let projectFilter = '';
    if (project_id) { projectFilter = ' AND l.project_id = ?'; params.push(project_id); }

    const byType = db.all(`
      SELECT l.leave_type, COALESCE(SUM(l.days), 0) AS total_days, COUNT(*) AS total_records
      FROM leaves l
      WHERE l.start_date BETWEEN ? AND ? ${projectFilter}
      GROUP BY l.leave_type
    `, ...params);

    const mParams = [`${y}-01-01`, `${y}-12-31`];
    let mFilter = '';
    if (project_id) { mFilter = ' AND m.project_id = ?'; mParams.push(project_id); }
    const byMember = db.all(`
      SELECT m.id, m.name, r.name AS role_name,
             COALESCE(SUM(CASE WHEN l.leave_type = 'PL'            THEN l.days ELSE 0 END), 0) AS pl_days,
             COALESCE(SUM(CASE WHEN l.leave_type = 'Sick Leave'    THEN l.days ELSE 0 END), 0) AS sick_days,
             COALESCE(SUM(CASE WHEN l.leave_type = 'Unplanned Leave' THEN l.days ELSE 0 END), 0) AS unplanned_days
      FROM members m
      LEFT JOIN roles r ON m.role_id = r.id
      LEFT JOIN leaves l ON l.member_id = m.id AND l.start_date BETWEEN ? AND ? ${mFilter}
      GROUP BY m.id
      ORDER BY pl_days DESC
    `, ...mParams);

    const byMonth = db.all(`
      SELECT strftime('%m', l.start_date) AS month,
             COALESCE(SUM(l.days), 0) AS total_days
      FROM leaves l
      WHERE l.start_date BETWEEN ? AND ? ${projectFilter}
      GROUP BY month
      ORDER BY month
    `, ...params);

    // For the interactive pie chart — by project
    const byProject = db.all(`
      SELECT COALESCE(p.name, 'Unassigned') AS name,
             COALESCE(SUM(l.days), 0) AS total_days,
             COUNT(*) AS total_records
      FROM leaves l
      LEFT JOIN projects p ON l.project_id = p.id
      WHERE l.start_date BETWEEN ? AND ?
      GROUP BY p.id
      ORDER BY total_days DESC
    `, `${y}-01-01`, `${y}-12-31`);

    // For the interactive pie chart — by member
    const byMemberShare = db.all(`
      SELECT m.id, m.name, r.name AS role_name, p.name AS project_name,
             COALESCE(SUM(l.days), 0) AS total_days
      FROM members m
      LEFT JOIN roles r ON m.role_id = r.id
      LEFT JOIN projects p ON m.project_id = p.id
      LEFT JOIN leaves l ON l.member_id = m.id AND l.start_date BETWEEN ? AND ?
      GROUP BY m.id
      ORDER BY total_days DESC
    `, `${y}-01-01`, `${y}-12-31`);

    res.json({ year: Number(y), byType, byMember, byMonth, byProject, byMemberShare });
  });

  // ===== Serve client build =====
  const clientBuild = path.join(__dirname, '..', 'client', 'build');
  if (fs.existsSync(clientBuild)) {
    app.use(express.static(clientBuild));
    app.get(/^\/(?!api).*/, (req, res) => {
      res.sendFile(path.join(clientBuild, 'index.html'));
    });
  }

  app.listen(PORT, () => console.log(`Leave Tracker API running on http://localhost:${PORT}`));
}

start().catch(err => { console.error('Failed to start server:', err); process.exit(1); });

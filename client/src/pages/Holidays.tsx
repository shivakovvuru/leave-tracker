import React, { useEffect, useState } from 'react';
import { Holidays as HolidaysApi } from '../api';
import { PublicHoliday } from '../types';
import Modal from '../components/Modal';
import { Button, Field, Input, EmptyState, Badge } from '../components/FormControls';
import { IconPlus, IconTrash, IconCalendar } from '../components/Icons';

const HolidaysPage: React.FC = () => {
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ date: '', name: '' });

  const refresh = () => { HolidaysApi.list().then(setHolidays); };
  useEffect(refresh, []);

  const save = async () => {
    if (!form.date || !form.name) return;
    await HolidaysApi.create(form);
    setForm({ date: '', name: '' });
    setShow(false);
    refresh();
  };
  const remove = async (id: number) => {
    if (!window.confirm('Delete this holiday?')) return;
    await HolidaysApi.remove(id);
    refresh();
  };

  const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = sorted.filter(h => h.date >= new Date().toISOString().slice(0, 10));
  const past     = sorted.filter(h => h.date <  new Date().toISOString().slice(0, 10));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Public Holidays</h1>
          <p className="page-sub">Manage company-wide public holidays. They are auto-applied across all calendars.</p>
        </div>
        <div className="page-actions">
          <Button onClick={() => setShow(true)} icon={<IconPlus size={16} />}>Add Holiday</Button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          image="/empty-projects.svg"
          title="No public holidays"
          subtitle="Add holidays like New Year, Independence Day, Christmas, etc."
          action={<Button onClick={() => setShow(true)} icon={<IconPlus size={16} />}>Add Holiday</Button>}
        />
      ) : (
        <>
          <div className="card">
            <div className="card-header">
              <h3>Upcoming</h3>
              <Badge tone="info">{upcoming.length}</Badge>
            </div>
            {upcoming.length === 0 ? (
              <div className="card-empty">No upcoming holidays.</div>
            ) : (
              <div className="holiday-list">
                {upcoming.map(h => (
                  <div key={h.id} className="holiday-row">
                    <div className="holiday-pill">
                      <div className="holiday-date">
                        {new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', { day: '2-digit' })}
                      </div>
                      <div>
                        <div className="holiday-month">
                          {new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                        </div>
                        <div className="holiday-name">{h.name}</div>
                      </div>
                    </div>
                    <div className="holiday-date-full">
                      {new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                    <button className="icon-btn danger" onClick={() => remove(h.id)}>
                      <IconTrash size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {past.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-header"><h3>Past Holidays</h3><Badge>{past.length}</Badge></div>
              <table className="data-table">
                <thead><tr><th>Date</th><th>Name</th><th></th></tr></thead>
                <tbody>
                  {past.map(h => (
                    <tr key={h.id}>
                      <td>{h.date}</td>
                      <td>{h.name}</td>
                      <td className="row-actions">
                        <button className="icon-btn danger" onClick={() => remove(h.id)}><IconTrash size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Modal
        open={show}
        title="Add Public Holiday"
        onClose={() => setShow(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShow(false)}>Cancel</Button>
            <Button onClick={save}>Add Holiday</Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Date" required>
            <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Holiday Name" required>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Diwali" />
          </Field>
        </div>
      </Modal>
    </div>
  );
};

export default HolidaysPage;

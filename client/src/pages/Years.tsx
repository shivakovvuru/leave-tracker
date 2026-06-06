import React, { useEffect, useState } from 'react';
import { Years as YearsApi } from '../api';
import { FiscalYear } from '../types';
import Modal from '../components/Modal';
import { Button, Field, Input, Badge, EmptyState } from '../components/FormControls';
import { IconPlus, IconTrash } from '../components/Icons';

const Years: React.FC = () => {
  const [items, setItems] = useState<FiscalYear[]>([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ year: new Date().getFullYear() + 1, label: '' });
  const [error, setError] = useState<string | null>(null);

  const refresh = () => { YearsApi.list().then(setItems); };
  useEffect(refresh, []);

  const add = async () => {
    setError(null);
    try {
      await YearsApi.create(Number(form.year), form.label || `FY ${form.year}`);
      setShow(false);
      setForm({ year: new Date().getFullYear() + 1, label: '' });
      refresh();
    } catch (e: any) {
      setError(e.message);
    }
  };
  const toggle = async (y: FiscalYear) => {
    await YearsApi.update(y.id, { active: !y.active });
    refresh();
  };
  const remove = async (id: number) => {
    if (!window.confirm('Delete this fiscal year? Holidays for it will lose their link.')) return;
    await YearsApi.remove(id);
    refresh();
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Fiscal Years</h1>
          <p className="page-sub">Add and manage the years your team tracks leaves for. The calendar and reports use the active year.</p>
        </div>
        <div className="page-actions">
          <Button onClick={() => setShow(true)} icon={<IconPlus size={16} />}>Add Year</Button>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          image="/empty-projects.svg"
          title="No fiscal years"
          subtitle={`Start by adding ${currentYear} to begin tracking leaves.`}
          action={<Button onClick={() => setShow(true)} icon={<IconPlus size={16} />}>Add Year</Button>}
        />
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>Label</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map(y => (
                <tr key={y.id}>
                  <td><div className="cell-primary">{y.year}</div></td>
                  <td>{y.label}</td>
                  <td>
                    {y.active
                      ? <Badge tone="success">Active</Badge>
                      : <Badge>Inactive</Badge>}
                  </td>
                  <td>{y.created_at?.slice(0, 10) || '—'}</td>
                  <td>
                    <div className="row-actions">
                      <Button size="sm" variant="secondary" onClick={() => toggle(y)}>
                        {y.active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <button className="icon-btn danger" onClick={() => remove(y.id)} title="Delete">
                        <IconTrash size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={show}
        title="Add Fiscal Year"
        onClose={() => setShow(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShow(false)}>Cancel</Button>
            <Button onClick={add}>Add Year</Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Year" required>
            <Input type="number" value={form.year} onChange={e => setForm({ ...form, year: Number(e.target.value) })} />
          </Field>
          <Field label="Label" hint="Optional, e.g. FY 2026">
            <Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
          </Field>
          {error && <div className="auth-error" style={{ gridColumn: '1 / -1' }}>{error}</div>}
        </div>
      </Modal>
    </div>
  );
};

export default Years;

'use client';

import { FeedbackRegion } from '@/components/ui/feedback';
import { PasswordInput } from '@/components/ui/password-input';
import { StatusBadge } from '@/components/ui/status-badge';
import { useState, useEffect } from 'react';
import { useAdmin } from './admin-provider';
import { PageHeading, Panel, Table, Empty, Modal, Field } from './admin-ui';
import { fetchEmployees, createEmployee, updateEmployee, deactivateEmployee } from '@/app/admin/actions/employees';
import { shortDate } from '@/lib/admin/analytics';

type AdminEmployee = {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  createdAt: string;
};

import { ALL_PERMISSIONS } from '@/lib/admin/permissions';

export function EmployeesLive() {
  const { notify, staff } = useAdmin();
  const [employees, setEmployees] = useState<AdminEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<AdminEmployee | null>(null);

  const [loadingAction, setLoadingAction] = useState(false);
  const [actionError, setActionError] = useState('');
  const [loadError, setLoadError] = useState('');

  async function load() {
    try {
      setLoadError('');
      const data = await fetchEmployees();
      setEmployees(data);
    } catch (err) {
      console.error(err);
      setLoadError('Failed to load employees. Please retry.');
    }
  }

  useEffect(() => {
    let ignore = false;
    
    fetchEmployees()
      .then(data => {
        if (!ignore) {
          setEmployees(data);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!ignore) {
          console.error(err);
          setLoadError('Failed to load employees. Please retry.');
          setLoading(false);
        }
      });

    return () => { ignore = true; };
  }, [notify]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loadingAction) return;
    setActionError('');
    setLoadingAction(true);
    const formData = new FormData(event.currentTarget);
    try {
      const res = await createEmployee(formData);
      if (res.success) {
        notify(`Employee created successfully: ${res.email}`);
        setCreateModal(false);
        load();
      } else {
        setActionError(res.error || 'Failed to create employee.');
      }
    } catch { setActionError('The operation could not be completed. Please try again.'); } finally {
      setLoadingAction(false);
    }
  }

  const availablePermissions = staff?.role === 'OWNER'
    ? ALL_PERMISSIONS
    : ALL_PERMISSIONS.filter(permission => staff?.permissions.includes(permission));
  const availableRoles = staff?.role === 'OWNER'
    ? ['ORDER_STAFF', 'MANAGER', 'OWNER']
    : ['ORDER_STAFF'];
  const canManageEmployee = (employee: AdminEmployee) =>
    staff?.role === 'OWNER' || employee.role === 'ORDER_STAFF';

  async function handleEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editModal) return;
    if (loadingAction) return;
    setActionError('');
    setLoadingAction(true);
    const formData = new FormData(event.currentTarget);
    try {
      const res = await updateEmployee(editModal.id, formData);
      if (res.success) {
        notify('Employee updated.');
        setEditModal(null);
        load();
      } else {
        setActionError(res.error || 'Failed to update employee.');
      }
    } catch { setActionError('The operation could not be completed. Please try again.'); } finally {
      setLoadingAction(false);
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm('Are you sure you want to deactivate this employee? They will lose access to the admin workspace immediately.')) return;
    if (loadingAction) return;
    setActionError('');
    setLoadingAction(true);
    try {
      const res = await deactivateEmployee(id);
      if (res.success) {
        notify('Employee deactivated.');
        load();
      } else {
        setActionError(res.error || 'Failed to deactivate employee.');
      }
    } catch { setActionError('The operation could not be completed. Please try again.'); } finally {
      setLoadingAction(false);
    }
  }

  return (
    <>
      <PageHeading 
        title="Employees" 
        description="Manage staff access, roles, and permissions." 
        action={<button className="ad-primary" disabled={loadingAction} onClick={() => { setActionError(''); setCreateModal(true); }}>Create Employee</button>}
      />

      <FeedbackRegion tone="danger">{!createModal && !editModal ? actionError : ''}</FeedbackRegion>
      <Panel title="Staff Members">
        <FeedbackRegion tone="danger">{loadError && <>{loadError} <button type="button" onClick={load}>Retry</button></>}</FeedbackRegion>
        {loading ? (
          <p style={{ padding: 40 }}>Loading employees...</p>
        ) : (
          <Table headings={['Name', 'Email', 'Role', 'Status', 'Joined', 'Actions']}>
            {employees.map(emp => (
              <tr key={emp.id} >
                <td><strong>{emp.name}</strong></td>
                <td>{emp.email}</td>
                <td>{emp.role.replaceAll('_', ' ')}</td>
                <td><StatusBadge tone={emp.isActive ? 'success' : 'neutral'}>{emp.isActive ? 'Active' : 'Inactive'}</StatusBadge></td>
                <td>{shortDate(emp.createdAt)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {canManageEmployee(emp) && <button type="button" disabled={loadingAction} onClick={() => { setActionError(''); setEditModal(emp); }} className="ad-secondary">
                      Edit
                    </button>}
                    {canManageEmployee(emp) && emp.isActive && staff?.userId !== emp.id && (
                      <button type="button" disabled={loadingAction} onClick={() => handleDeactivate(emp.id)} className="ad-danger">
                        {loadingAction ? 'Updating…' : 'Deactivate'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
        {!loading && !loadError && !employees.length && <Empty />}
      </Panel>

      {createModal && (
        <Modal title="Create Employee" close={() => { if (!loadingAction) setCreateModal(false); }}>
          <form onSubmit={handleCreate} className="ad-form" aria-busy={loadingAction}><FeedbackRegion tone="danger">{actionError}</FeedbackRegion>
            <Field label="Full Name">
              <input type="text" name="full_name" required autoComplete="name" />
            </Field>
            <Field label="Email Address">
              <input type="email" name="email" required placeholder="staff@example.com" autoComplete="email" />
            </Field>
            <Field label="Temporary Password">
              <PasswordInput name="password" minLength={8} required autoComplete="new-password" />
            </Field>
            <Field label="Confirm Temporary Password">
              <PasswordInput name="confirm_password" minLength={8} required autoComplete="new-password" />
            </Field>
            <p className="cc-helper">Order staff handle assigned tasks. Managers receive selected permissions. Owners have full administrative access.</p><Field label="Role">
              <select name="role" required>
                {availableRoles.map(role => <option key={role} value={role}>{role.replaceAll('_', ' ')}</option>)}
              </select>
            </Field>
            <fieldset style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
              <legend>Permissions</legend>
              {['orders', 'products', 'coupons', 'customers', 'dashboard', 'analytics', 'settings', 'employees', 'shipping'].map(group => {
                const permissions = availablePermissions.filter(p => p.startsWith(group + '.'));
                return permissions.length ? <fieldset className="cc-permissions" key={group}><legend>{group.charAt(0).toUpperCase() + group.slice(1)}</legend>{permissions.map(perm => <label key={perm}><input type="checkbox" name="permissions" value={perm} /><span>{perm.endsWith('.manage') ? 'Manage' : 'View'} {group}{perm.endsWith('.manage') && <small>Can make changes in this area.</small>}</span></label>)}</fieldset> : null;
              })}
            </fieldset>
            <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setCreateModal(false)}>Cancel</button>
              <button type="submit" className="ad-primary" disabled={loadingAction}>
                {loadingAction ? 'Creating...' : 'Create Employee'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editModal && (
        <Modal title={`Edit ${editModal.name}`} close={() => { if (!loadingAction) setEditModal(null); }}>
          <form onSubmit={handleEdit} className="ad-form" aria-busy={loadingAction}><FeedbackRegion tone="danger">{actionError}</FeedbackRegion>
            <Field label="Role">
              <select name="role" defaultValue={editModal.role} required>
                {availableRoles.map(role => <option key={role} value={role}>{role.replaceAll('_', ' ')}</option>)}
              </select>
            </Field>
            <Field label="Account Status">
              <select name="is_active" defaultValue={editModal.isActive ? "true" : "false"} required>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </Field>
            <fieldset style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
              <legend>Permissions</legend>
              {['orders', 'products', 'coupons', 'customers', 'dashboard', 'analytics', 'settings', 'employees', 'shipping'].map(group => {
                const permissions = availablePermissions.filter(p => p.startsWith(group + '.'));
                return permissions.length ? <fieldset className="cc-permissions" key={group}><legend>{group.charAt(0).toUpperCase() + group.slice(1)}</legend>{permissions.map(perm => <label key={perm}><input type="checkbox" name="permissions" value={perm} defaultChecked={editModal.permissions.includes(perm)}/><span>{perm.endsWith('.manage') ? 'Manage' : 'View'} {group}{perm.endsWith('.manage') && <small>Can make changes in this area.</small>}</span></label>)}</fieldset> : null;
              })}
            </fieldset>
            <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setEditModal(null)}>Cancel</button>
              <button type="submit" className="ad-primary" disabled={loadingAction}>
                {loadingAction ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

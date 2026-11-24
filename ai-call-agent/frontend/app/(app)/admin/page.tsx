'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { ArrowUpRight, BadgeCheck, FileText, Hash, PhoneIncoming, Search, Shield, ShieldCheck, Trash2, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatDateTime, formatPhone } from '@/lib/format';
import type { AdminOverview, AdminReportRow, AdminUserRow } from '@/lib/types';
import { Avatar, Card, CardHeader, IconTile, PageHeader } from '@/components/ui/card';
import { Badge, ReportStatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Empty, Skeleton } from '@/components/ui/feedback';
import { Dialog } from '@/components/ui/overlay';
import { useToast } from '@/components/ui/toast';
import { StatTile, WeekChart } from '@/components/charts';

const th = 'px-3 py-3 text-[11px] font-semibold tracking-wider text-ink-3 uppercase';

function UsersTable() {
  const { user: me } = useAuth();
  const toast = useToast();
  const { data, mutate } = useSWR<AdminUserRow[]>('/api/admin/users');
  const [removing, setRemoving] = useState<AdminUserRow | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [query, setQuery] = useState('');

  const needle = query.trim().toLowerCase();
  const rows = (data ?? []).filter((r) => !needle || r.name.toLowerCase().includes(needle) || r.email.toLowerCase().includes(needle) || (r.phone ?? '').includes(needle));

  async function setRole(row: AdminUserRow, role: 'user' | 'admin') {
    setBusy(row.id);
    try {
      const updated = await api<AdminUserRow>(`/api/admin/users/${row.id}`, { method: 'PATCH', body: { role } });
      mutate((list) => list?.map((r) => (r.id === row.id ? updated : r)), { revalidate: false });
      toast(role === 'admin' ? `${row.name} is now an admin` : `${row.name} is now a user`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not change role', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!removing) return;
    setBusy(removing.id);
    try {
      await api(`/api/admin/users/${removing.id}`, { method: 'DELETE' });
      mutate((list) => list?.filter((r) => r.id !== removing.id), { revalidate: false });
      toast(`${removing.name} was deleted`);
      setRemoving(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete', 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={
          <span className="flex items-center gap-2.5">
            Users
            <span className="tabular rounded-full bg-subtle px-2 py-0.5 text-xs font-semibold text-ink-2">{data?.length ?? 0}</span>
          </span>
        }
        icon={<Users />}
        tone="accent"
        actions={
          <div className="relative hidden w-64 sm:block">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <Input className="h-9 pl-9" placeholder="Search users" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        }
      />
      {!data ? (
        <div className="space-y-2 p-5">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : rows.length === 0 ? (
        <Empty icon={<Users className="h-5 w-5" />} title="No users match" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-190 text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className={`${th} pl-5`}>User</th>
                <th className={th}>Role</th>
                <th className={`${th} text-right`}>Calls</th>
                <th className={`${th} text-right`}>Scams</th>
                <th className={`${th} text-right`}>Reports</th>
                <th className={th}>Joined</th>
                <th className={`${th} pr-5 text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => {
                const self = row.id === me?.id;
                return (
                  <tr key={row.id} className="transition-colors hover:bg-subtle">
                    <td className="py-3 pr-3 pl-5">
                      <div className="flex items-center gap-3">
                        <Avatar name={row.name} size="sm" />
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-ink">
                            {row.name}
                            {self && <span className="ml-1.5 text-xs font-normal text-ink-3">(you)</span>}
                          </div>
                          <div className="truncate text-xs text-ink-3">
                            {row.email}
                            {row.phone ? ` · ${formatPhone(row.phone)}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={row.role === 'admin' ? 'accent' : 'neutral'} dot>
                        {row.role === 'admin' ? 'Admin' : 'User'}
                      </Badge>
                    </td>
                    <td className="tabular px-3 py-3 text-right font-medium text-ink">{row.calls}</td>
                    <td className="tabular px-3 py-3 text-right font-medium text-ink">{row.scams}</td>
                    <td className="tabular px-3 py-3 text-right font-medium text-ink">{row.reports}</td>
                    <td className="tabular px-3 py-3 whitespace-nowrap text-ink-3">{formatDate(row.created_at)}</td>
                    <td className="py-3 pr-5 pl-3">
                      <div className="flex justify-end gap-1.5">
                        {!self && (
                          <Button size="sm" variant="secondary" loading={busy === row.id} onClick={() => setRole(row, row.role === 'admin' ? 'user' : 'admin')}>
                            {row.role === 'admin' ? 'Make user' : 'Make admin'}
                          </Button>
                        )}
                        {!self && (
                          <button
                            onClick={() => setRemoving(row)}
                            className="rounded-lg p-2 text-ink-3 transition-colors hover:bg-danger-soft hover:text-danger"
                            aria-label={`Delete ${row.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Dialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="Delete this account?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy === removing?.id} onClick={remove}>
              Delete
            </Button>
          </>
        }
      >
        {removing?.name}&apos;s calls, reports and settings will be removed permanently.
      </Dialog>
    </Card>
  );
}

function ReportsTable() {
  const { data } = useSWR<AdminReportRow[]>('/api/admin/reports?limit=50');
  return (
    <Card className="overflow-hidden">
      <CardHeader title="All police reports" icon={<FileText />} tone="accent" />
      {!data ? (
        <div className="p-5">
          <Skeleton className="h-12" />
        </div>
      ) : data.length === 0 ? (
        <Empty icon={<FileText className="h-5 w-5" />} title="No reports yet" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-190 text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className={`${th} pl-5`}>Report</th>
                <th className={th}>Filed by</th>
                <th className={th}>Police station</th>
                <th className={th}>Status</th>
                <th className={`${th} pr-5 text-right`}>Filed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((report) => (
                <tr key={report.id} className="transition-colors hover:bg-subtle">
                  <td className="py-3 pr-3 pl-5">
                    <div className="flex items-center gap-3">
                      <IconTile size="sm" tone={report.status === 'acknowledged' ? 'safe' : report.status === 'sent' ? 'accent' : 'warn'}>
                        {report.status === 'acknowledged' ? <BadgeCheck /> : <FileText />}
                      </IconTile>
                      <div className="min-w-0">
                        <div className="font-semibold text-ink">{formatPhone(report.caller_number)}</div>
                        <div className="truncate text-xs text-ink-3">
                          {report.reference} · {report.category}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={report.user_name} size="sm" className="h-7 w-7 text-[11px]" />
                      <span className="truncate text-ink-2">{report.user_name}</span>
                    </div>
                  </td>
                  <td className="max-w-56 truncate px-3 py-3 text-ink-2">{report.station_name || '—'}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <ReportStatusBadge status={report.status} />
                      {report.mode === 'test' && <Badge>Test</Badge>}
                    </div>
                  </td>
                  <td className="py-3 pr-5 pl-3 text-right whitespace-nowrap">
                    {report.public_url ? (
                      <a href={report.public_url} target="_blank" rel="noreferrer" className="tabular inline-flex items-center gap-1 text-accent hover:text-accent-hover">
                        {formatDateTime(report.created_at)}
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="tabular text-ink-3">{formatDateTime(report.created_at)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function PlatformRow({ icon, tone, label, value }: { icon: React.ReactNode; tone: 'safe' | 'warn' | 'accent'; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 py-3.5">
      <IconTile size="sm" tone={tone}>
        {icon}
      </IconTile>
      <span className="flex-1 text-sm text-ink-2">{label}</span>
      <span className="tabular text-lg font-semibold text-ink">{value.toLocaleString('en-IN')}</span>
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const { data } = useSWR<AdminOverview>(user?.role === 'admin' ? '/api/admin/overview' : null);

  if (user && user.role !== 'admin') {
    return (
      <Card className="py-10">
        <Empty
          icon={<Shield className="h-5 w-5" />}
          title="Only admins can open this page"
          action={
            <Link href="/dashboard" className="text-sm font-medium text-accent hover:text-accent-hover">
              Back to dashboard
            </Link>
          }
        />
      </Card>
    );
  }

  const week = data?.last_7_days ?? [];
  const ackRate = data?.reports_sent ? Math.round((data.reports_acknowledged / data.reports_sent) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin"
        meta={
          <Badge tone="accent" dot>
            Super admin
          </Badge>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data ? (
          <>
            <StatTile label="Users" value={data.users} icon={<Users className="h-4.5 w-4.5" />} tone="accent" footer={`${data.admins} admin${data.admins === 1 ? '' : 's'}`} />
            <StatTile
              label="Calls screened"
              value={data.calls}
              icon={<PhoneIncoming className="h-4.5 w-4.5" />}
              tone="accent"
              spark={week.map((d) => d.total)}
              footer={`${week.reduce((s, d) => s + d.total, 0)} this week`}
            />
            <StatTile
              label="Scams blocked"
              value={data.scams_blocked}
              icon={<ShieldCheck className="h-4.5 w-4.5" />}
              tone="danger"
              spark={week.map((d) => d.spam)}
              footer={`${data.calls ? Math.round((data.scams_blocked / data.calls) * 100) : 0}% of calls`}
            />
            <StatTile label="Reports sent" value={data.reports_sent} icon={<FileText className="h-4.5 w-4.5" />} tone="neutral" footer={`${data.reports_acknowledged} acknowledged`} />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-37.5 rounded-2xl" />)
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Calls across all users" actions={data && <span className="tabular text-sm font-semibold text-ink">{week.reduce((s, d) => s + d.total, 0)} calls</span>} />
          <div className="p-5">{data ? <WeekChart days={week} /> : <Skeleton className="h-52" />}</div>
        </Card>
        <Card>
          <CardHeader title="Platform" />
          <div className="px-5 pt-1 pb-5">
            {data ? (
              <>
                <div className="divide-y divide-line">
                  <PlatformRow icon={<BadgeCheck />} tone="safe" label="Acknowledged by police" value={data.reports_acknowledged} />
                  <PlatformRow icon={<Hash />} tone="warn" label="Reported numbers" value={data.reported_numbers} />
                  <PlatformRow icon={<Shield />} tone="accent" label="Admins" value={data.admins} />
                </div>
                <div className="mt-3 rounded-xl border border-line bg-bg p-4">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-medium text-ink-2">Police response rate</span>
                    <span className="tabular font-semibold text-ink">{ackRate}%</span>
                  </div>
                  <div className="mt-2.5 h-2 rounded-full bg-safe-soft">
                    <div className="h-2 rounded-full bg-safe" style={{ width: `${ackRate}%` }} />
                  </div>
                </div>
              </>
            ) : (
              <Skeleton className="mt-4 h-48" />
            )}
          </div>
        </Card>
      </div>

      <UsersTable />
      <ReportsTable />
    </div>
  );
}

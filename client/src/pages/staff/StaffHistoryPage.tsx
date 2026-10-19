import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Filter, History, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { CHECKIN_LABELS, scanVerdict } from '@/components/checkin/scan-verdict';
import { StaffEmptyState } from '@/components/staff/StaffEmptyState';
import { ASSIGNMENT_STATE, historySummary } from '@/lib/staff-portal';
import { getAssignmentCheckins, getStaffAssignments } from '@/services/checkin.service';
import type { CheckinLog, StaffAssignment } from '@/services/checkin.service';

const format = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const timeOnly = (value: string) => new Date(value).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const dateOnly = (value: string) => new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' });

export function StaffHistoryPage() {
  const { token } = useAuth();
  const [assignments, setAssignments] = useState<StaffAssignment[]>([]);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [assignmentTotal, setAssignmentTotal] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const [logs, setLogs] = useState<CheckinLog[]>([]);
  const [logPage, setLogPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);
  const [logReload, setLogReload] = useState(0);
  const [result, setResult] = useState<CheckinLog['code'] | ''>('');
  const [summary, setSummary] = useState<{ total: number; allowed: number; refused: number } | null>(null);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [assignmentError, setAssignmentError] = useState('');
  const [logsError, setLogsError] = useState('');
  const assignmentLimit = 20;
  const logLimit = 20;

  useEffect(() => {
    const controller = new AbortController();
    // Lịch sử quét phải gồm cả ca đang mở. `segment=history` chỉ chứa Event đã
    // kết thúc/thu hồi nên từng làm các lượt quét vừa thực hiện biến mất khỏi UI.
    getStaffAssignments(token, { segment: 'all', page: assignmentPage, limit: assignmentLimit }, controller.signal)
      .then(({ data, meta }) => {
        if (!controller.signal.aborted) {
          setAssignments(data); setAssignmentTotal(meta?.total ?? 0);
          setLogPage(1);
          if (data.length === 0) {
            setSelectedId(''); setLogs([]); setLogTotal(0); setLoadingLogs(false); setLogsError(''); setSummary(null);
          } else {
            setLoadingLogs(true);
            setSelectedId((current) => data.some((item) => String(item.assignmentId) === current) ? current : String(data[0]!.assignmentId));
          }
          setAssignmentError('');
        }
      })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setAssignmentError(cause instanceof Error ? cause.message : 'Không thể tải lịch sử phân công.'); })
      .finally(() => { if (!controller.signal.aborted) setLoadingAssignments(false); });
    return () => controller.abort();
  }, [token, assignmentPage]);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    getAssignmentCheckins(Number(selectedId), token, { page: logPage, limit: logLimit, result: result || undefined }, controller.signal)
      .then(({ data, meta }) => { if (!controller.signal.aborted) { setLogs(data); setLogTotal(meta?.total ?? 0); setLogsError(''); } })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setLogsError(cause instanceof Error ? cause.message : 'Không thể tải lịch sử check-in.'); })
      .finally(() => { if (!controller.signal.aborted) setLoadingLogs(false); });
    return () => controller.abort();
  }, [selectedId, token, logPage, result, logReload]);

  // Summary strip: two server totals for the whole assignment (all results / SUCCESS), never page-derived.
  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    const id = Number(selectedId);
    Promise.all([
      getAssignmentCheckins(id, token, { page: 1, limit: 1 }, controller.signal),
      getAssignmentCheckins(id, token, { page: 1, limit: 1, result: 'SUCCESS' }, controller.signal),
    ])
      .then(([all, success]) => { if (!controller.signal.aborted) setSummary(historySummary(all.meta?.total ?? 0, success.meta?.total ?? 0)); })
      .catch(() => { if (!controller.signal.aborted) setSummary(null); });
    return () => controller.abort();
  }, [selectedId, token, logReload]);

  const assignmentPages = Math.max(1, Math.ceil(assignmentTotal / assignmentLimit));
  const logPages = Math.max(1, Math.ceil(logTotal / logLimit));
  const selectedAssignment = assignments.find((assignment) => String(assignment.assignmentId) === selectedId) ?? null;
  const chooseResult = (next: CheckinLog['code'] | '') => {
    if (next === result) return;
    setLoadingLogs(true);
    setLogPage(1);
    setResult(next);
  };

  return (
    <div className="sp-page">
      <header className="sp-page-head">
        <div>
          <h1>Lịch sử quét vé cá nhân</h1>
          <p>Các lượt quét do chính bạn thực hiện ở ca đang mở, đã kết thúc hoặc đã được thu hồi. Dữ liệu chỉ đọc.</p>
        </div>
      </header>

      {assignmentError && <div className="sp-alert is-danger" role="alert">{assignmentError}</div>}

      <div className="sp-card sp-history-filters">
        <label className="sp-field">
          <span><History size={16} aria-hidden="true" />Sự kiện được phân công</span>
          <select
            value={selectedId}
            disabled={loadingAssignments || assignments.length === 0}
            onChange={(event) => {
              setLoadingLogs(true);
              setLogPage(1);
              setSummary(null);
              setSelectedId(event.target.value);
            }}
          >
            {assignments.length === 0 ? (
              <option value="">Chưa có sự kiện được phân công</option>
            ) : (
              assignments.map((assignment) => (
                <option key={assignment.assignmentId} value={assignment.assignmentId}>
                  {assignment.name} · {ASSIGNMENT_STATE[assignment.operationalState].label}
                </option>
              ))
            )}
          </select>
          {/* Always one line, so the filter card keeps its height before the shifts are loaded. */}
          <small aria-hidden={!selectedAssignment}>{selectedAssignment ? <>Ca check-in: {format(selectedAssignment.checkinStartAt)} — {format(selectedAssignment.checkinEndAt)}</> : '\u00a0'}</small>
        </label>

        <label className="sp-field">
          <span><Filter size={16} aria-hidden="true" />Kết quả quét</span>
          <select value={result} disabled={!selectedId} onChange={(event) => chooseResult(event.target.value as CheckinLog['code'] | '')}>
            <option value="">Tất cả kết quả</option>
            {Object.entries(CHECKIN_LABELS).map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </label>

        <button
          type="button"
          disabled={loadingLogs || !selectedId}
          onClick={() => { setLoadingLogs(true); setLogPage(1); setLogReload((value) => value + 1); }}
          className="sp-btn sp-btn--outline sp-history-refresh"
        >
          <RefreshCw size={16} className={loadingLogs ? 'animate-spin' : ''} aria-hidden="true" />Làm mới
        </button>
      </div>

      {assignmentPages > 1 && (
        <nav className="sp-pager is-end" aria-label="Phân trang sự kiện được phân công">
          <button className="sp-btn sp-btn--ghost sp-btn--sm" type="button" disabled={assignmentPage === 1}
            onClick={() => { setLoadingAssignments(true); setAssignmentPage((page) => page - 1); }}><ChevronLeft size={16} aria-hidden="true" />Sự kiện trước</button>
          <span className="tb-num">{assignmentPage}/{assignmentPages}</span>
          <button className="sp-btn sp-btn--ghost sp-btn--sm" type="button" disabled={assignmentPage === assignmentPages}
            onClick={() => { setLoadingAssignments(true); setAssignmentPage((page) => page + 1); }}>Sự kiện sau<ChevronRight size={16} aria-hidden="true" /></button>
        </nav>
      )}

      {logsError && <div className="sp-alert is-danger" role="alert">{logsError}</div>}

      <section className="sp-card sp-history" aria-labelledby="sp-history-title">
        <header className="sp-history-head">
          <h2 id="sp-history-title">Lượt quét do bạn thực hiện · <span className="tb-num">{logTotal}</span> kết quả</h2>
          {(selectedId || loadingAssignments) && (
            <div className="sp-summary" aria-label="Tổng hợp cả ca trực đã chọn">
              <button type="button" className="sp-summary-item" aria-pressed={result === ''} onClick={() => chooseResult('')}
                aria-label={`Hiện tất cả lượt quét: ${summary?.total ?? '—'}`}>
                Tổng lượt quét <strong className="tb-num">{summary?.total ?? '—'}</strong>
              </button>
              <button type="button" className="sp-summary-item is-ok" aria-pressed={result === 'SUCCESS'} onClick={() => chooseResult('SUCCESS')}
                aria-label={`Chỉ hiện lượt cho vào: ${summary?.allowed ?? '—'}`}>
                Cho vào <strong className="tb-num">{summary?.allowed ?? '—'}</strong>
              </button>
              <span className="sp-summary-item is-static is-bad">
                Từ chối / trùng <strong className="tb-num">{summary?.refused ?? '—'}</strong>
              </span>
            </div>
          )}
        </header>

        {loadingLogs ? (
          <p className="sp-loading" role="status">Đang tải lịch sử soát vé…</p>
        ) : logs.length === 0 ? (
          <StaffEmptyState icon={History} title={selectedId ? 'Chưa có lượt quét cho bộ lọc hiện tại' : 'Chưa có sự kiện để xem lịch sử quét'}>
            <p>{selectedId ? (result ? 'Thử chọn "Tất cả kết quả" hoặc một ca trực khác.' : 'Lượt quét bạn thực hiện tại cổng sẽ xuất hiện ở đây.') : 'Khi được phân công và quét vé, lịch sử của bạn sẽ được lưu ở đây.'}</p>
          </StaffEmptyState>
        ) : (
          <div className="sp-table-wrap">
            <table className="sp-table">
              <thead>
                <tr>
                  <th scope="col">Thời điểm</th>
                  <th scope="col">Mã quét đã che</th>
                  <th scope="col">Kết quả</th>
                  <th scope="col">Thông báo</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const tone = scanVerdict(log.code).tone;
                  return (
                    <tr key={log.id}>
                      <td><strong className="tb-num">{timeOnly(log.checkedAt)}</strong><span className="sp-table-sub tb-num">{dateOnly(log.checkedAt)}</span></td>
                      <td><span className="sp-code tb-mono">{log.scannedCode}</span></td>
                      <td><span className={`sp-status is-${tone}`}>{CHECKIN_LABELS[log.code] ?? log.code}</span></td>
                      <td className="sp-table-msg">{log.message}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {logPages > 1 && (
        <nav className="sp-pager" aria-label="Phân trang lịch sử lượt quét">
          <button className="sp-btn sp-btn--ghost sp-btn--sm" type="button" disabled={logPage === 1}
            onClick={() => { setLoadingLogs(true); setLogPage((page) => page - 1); }}><ChevronLeft size={16} aria-hidden="true" />Trước</button>
          <span className="tb-num">Trang {logPage}/{logPages}</span>
          <button className="sp-btn sp-btn--ghost sp-btn--sm" type="button" disabled={logPage === logPages}
            onClick={() => { setLoadingLogs(true); setLogPage((page) => page + 1); }}>Sau<ChevronRight size={16} aria-hidden="true" /></button>
        </nav>
      )}
    </div>
  );
}

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { BookOpenCheck, Check, ChevronDown, Download, FileDown, FileUp, RotateCcw, Settings2, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';

type TestMark = { obtained: string; total: string };
type Subject = {
  id: string;
  name: string;
  a: number;
  e: number;
  tests: TestMark[];
  terminal: string;
};
type StoredData = { version: 1; subjects: Subject[] };
type CatalogItem = { name: string; a: number; e: number };

const STORAGE_KEY = 'as-grade-ledger-v1';
const DEFAULTS: CatalogItem[] = [
  { name: 'Physics', a: 72, e: 36 },
  { name: 'Chemistry', a: 66, e: 33 },
  { name: 'Biology', a: 67, e: 35 },
  { name: 'Mathematics', a: 80, e: 38 },
  { name: 'Further Math', a: 73, e: 30 },
  { name: 'Computer Science', a: 60, e: 30 },
  { name: 'English General Paper', a: 66, e: 33 },
  { name: 'English Language', a: 71, e: 35 },
  { name: 'Economics', a: 65, e: 33 },
  { name: 'Business', a: 65, e: 38 },
  { name: 'Psychology', a: 66, e: 32 },
  { name: 'Sociology', a: 66, e: 32 },
];
const emptyTests = (): TestMark[] => Array.from({ length: 4 }, () => ({ obtained: '', total: '' }));
const makeSubject = (item: CatalogItem, existing?: Subject): Subject => ({
  id: existing?.id ?? `${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(36).slice(2, 7)}`,
  name: item.name,
  a: item.a,
  e: item.e,
  tests: existing?.tests ?? emptyTests(),
  terminal: existing?.terminal ?? '',
});
const validSubject = (item: unknown): item is Subject => {
  if (!item || typeof item !== 'object') return false;
  const value = item as Subject;
  return typeof value.id === 'string' && typeof value.name === 'string' &&
    Number.isFinite(value.a) && Number.isFinite(value.e) && value.a > value.e &&
    value.a <= 100 && value.e >= 0 && Array.isArray(value.tests) && value.tests.length === 4 &&
    value.tests.every((test) => test && typeof test.obtained === 'string' && typeof test.total === 'string') &&
    typeof value.terminal === 'string';
};
const numeric = (value: string): number | null => value.trim() === '' ? null : Number(value);
const getProgress = (subject: Subject) => {
  const tests = subject.tests.filter((test) => test.obtained !== '' || test.total !== '');
  const completeTests = subject.tests.filter((test) => {
    const obtained = numeric(test.obtained);
    const total = numeric(test.total);
    return obtained !== null && total !== null && Number.isFinite(obtained) && Number.isFinite(total) && total > 0 && obtained >= 0 && obtained <= total;
  }).length;
  const terminal = numeric(subject.terminal);
  const terminalDone = terminal !== null && Number.isFinite(terminal) && terminal >= 0 && terminal <= 100;
  return { completed: completeTests + (terminalDone ? 1 : 0), started: tests.length > 0 || subject.terminal !== '', completeTests, terminalDone };
};
const getPa = (subject: Subject): number | null => {
  const marks = subject.tests.map((test) => {
    const obtained = numeric(test.obtained);
    const total = numeric(test.total);
    return obtained !== null && total !== null && Number.isFinite(obtained) && Number.isFinite(total) && total > 0 && obtained >= 0 && obtained <= total
      ? (obtained / total) * 100 : null;
  });
  return marks.every((mark) => mark !== null) ? marks.reduce<number>((sum, mark) => sum + (mark ?? 0), 0) / 4 : null;
};
const getFinal = (subject: Subject): number | null => {
  const pa = getPa(subject);
  const terminal = numeric(subject.terminal);
  return pa !== null && terminal !== null && Number.isFinite(terminal) && terminal >= 0 && terminal <= 100
    ? pa * 0.4 + terminal * 0.6 : null;
};
const gradeFor = (score: number, subject: Subject): string => {
  const step = (subject.a - subject.e) / 4;
  if (score >= subject.a) return 'A';
  if (score >= subject.a - step) return 'B';
  if (score >= subject.a - 2 * step) return 'C';
  if (score >= subject.a - 3 * step) return 'D';
  if (score >= subject.e) return 'E';
  return 'U';
};
const fmt = (value: number | null) => value === null ? '—' : `${value.toFixed(1)}%`;

function Home() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>(DEFAULTS);
  const [customName, setCustomName] = useState('');
  const [customA, setCustomA] = useState('70');
  const [customE, setCustomE] = useState('35');
  const [setupError, setSetupError] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [confirm, setConfirm] = useState<'reset' | 'reconfigure' | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [toast, setToast] = useState('');
  const [savedAt, setSavedAt] = useState('');
  const importRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredData;
        if (parsed.version === 1 && Array.isArray(parsed.subjects) && parsed.subjects.length >= 5 && parsed.subjects.length <= 6 && parsed.subjects.every(validSubject)) {
          setSubjects(parsed.subjects);
        }
      }
    } catch {
      // A malformed local backup should never prevent the tracker from opening.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded || subjects.length === 0) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, subjects } satisfies StoredData));
      setSavedAt(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
    } catch {
      notify('Your browser could not save this update. Export a backup to keep it safe.');
    }
  }, [subjects, loaded]);

  const notify = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2800);
  };

  const openSetup = () => {
    const existing = subjects.map((subject) => makeSubject({ name: subject.name, a: subject.a, e: subject.e }, subject));
    setCatalog([...DEFAULTS, ...existing.filter((subject) => !DEFAULTS.some((item) => item.name.toLowerCase() === subject.name.toLowerCase())).map(({ name, a, e }) => ({ name, a, e }))]);
    setSelected(subjects.map((subject) => subject.name));
    setSetupError('');
    setShowSetup(true);
  };

  const toggleSubject = (name: string) => {
    setSelected((current) => current.includes(name) ? current.filter((item) => item !== name) : current.length < 6 ? [...current, name] : current);
    setSetupError('');
  };

  const addCustom = () => {
    const name = customName.trim();
    const a = Number(customA);
    const e = Number(customE);
    if (!name) { setSetupError('Give your subject a name first.'); return; }
    if (catalog.some((item) => item.name.toLowerCase() === name.toLowerCase())) { setSetupError('That subject is already in your list.'); return; }
    if (!Number.isFinite(a) || !Number.isFinite(e) || a < 0 || a > 100 || e < 0 || e > 100 || a <= e) {
      setSetupError('A minimum must be 0–100 and higher than the E minimum.'); return;
    }
    setCatalog((current) => [...current, { name, a, e }]);
    setSelected((current) => current.length < 6 ? [...current, name] : current);
    setCustomName('');
    setSetupError('');
  };

  const commitSetup = () => {
    if (selected.length < 5 || selected.length > 6) {
      setSetupError('Choose exactly five or six subjects to continue.'); return;
    }
    const next = selected.map((name) => {
      const item = catalog.find((candidate) => candidate.name === name)!;
      const previous = subjects.find((subject) => subject.name === name);
      return makeSubject(item, previous);
    });
    setSubjects(next);
    setShowSetup(false);
    notify('Your subject list is ready.');
  };

  const updateTest = (subjectId: string, index: number, key: keyof TestMark, value: string) => {
    setSubjects((current) => current.map((subject) => subject.id !== subjectId ? subject : {
      ...subject,
      tests: subject.tests.map((test, testIndex) => testIndex === index ? { ...test, [key]: value } : test),
    }));
  };
  const updateSubject = (subjectId: string, patch: Partial<Subject>) => {
    setSubjects((current) => current.map((subject) => subject.id === subjectId ? { ...subject, ...patch } : subject));
  };
  const toggleThreshold = (id: string) => setExpanded((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), subjects }, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'my-as-grade-ledger.json');
    notify('Backup downloaded. Keep it somewhere safe.');
  };
  const exportReport = () => {
    const rows = [
      ['Subject', 'PA average (%)', 'Terminal (%)', 'Weighted result (%)', 'Current grade', 'A minimum (%)', 'E minimum (%)'],
      ...subjects.map((subject) => {
        const final = getFinal(subject);
        return [subject.name, getPa(subject)?.toFixed(1) ?? '', subject.terminal, final?.toFixed(1) ?? 'Incomplete', final === null ? 'In progress' : gradeFor(final, subject), String(subject.a), String(subject.e)];
      }),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'my-as-grade-report.csv');
    notify('Your grade report is ready to save or share.');
  };
  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { subjects?: unknown[]; version?: number };
      if (parsed.version !== 1 || !Array.isArray(parsed.subjects) || parsed.subjects.length < 5 || parsed.subjects.length > 6 || !parsed.subjects.every(validSubject) ||
        new Set(parsed.subjects.map((subject) => (subject as Subject).name.toLowerCase())).size !== parsed.subjects.length) {
        throw new Error('This backup does not contain a valid set of five or six subjects.');
      }
      setSubjects(parsed.subjects as Subject[]);
      setShowSetup(false);
      notify('Backup restored successfully.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not read that backup file.');
    }
    event.target.value = '';
  };
  const confirmAction = () => {
    if (confirm === 'reset') {
      setSubjects([]);
      localStorage.removeItem(STORAGE_KEY);
      setShowSetup(false);
      notify('Your ledger has been cleared.');
    } else if (confirm === 'reconfigure') {
      setConfirm(null);
      openSetup();
      return;
    }
    setConfirm(null);
  };

  const completed = subjects.filter((subject) => getFinal(subject) !== null);
  const average = completed.length ? completed.reduce((sum, subject) => sum + (getFinal(subject) ?? 0), 0) / completed.length : null;
  const ready = subjects.length > 0;

  if (!loaded) return <div className="app-shell" data-testid="app-loading"><div className="main-wrap">Opening your grade ledger…</div></div>;

  return (
    <div className="app-shell" data-testid="grade-ledger-app">
      <header className="topbar">
        <div className="brand" data-testid="app-brand">
          <span className="brand-mark"><BookOpenCheck size={18} strokeWidth={1.8} /></span>
          <span><span className="brand-name">little ledger</span><span className="brand-tag">your AS grade companion</span></span>
        </div>
        {ready && <div className="top-actions">
          <button className="icon-button" onClick={exportBackup} data-testid="export-backup-button" aria-label="Download JSON backup"><Download size={15} /><span className="action-label">Backup</span></button>
          <button className="icon-button" onClick={() => importRef.current?.click()} data-testid="import-backup-button" aria-label="Restore from JSON backup"><FileUp size={15} /><span className="action-label">Restore</span></button>
          <button className="icon-button" onClick={exportReport} data-testid="export-report-button" aria-label="Download grade report"><FileDown size={15} /><span className="action-label">Report</span></button>
          <button className="icon-button" onClick={() => window.print()} data-testid="print-report-button" aria-label="Print grade report"><span className="action-label">Print</span></button>
        </div>}
      </header>

      <input className="file-input" ref={importRef} type="file" accept="application/json,.json" onChange={handleImport} data-testid="backup-file-input" />

      <main className="main-wrap">
        {!ready && !showSetup && (
          <section className="empty-state" data-testid="first-run-state">
            <div className="eyebrow">A clearer view of your progress</div>
            <h1 className="setup-heading">Your marks, in one gentle place.</h1>
            <p className="setup-lead">Set up five or six AS subjects, add marks as you get them, and see what they mean against your own grade thresholds. Your ledger stays on this device.</p>
            <button className="primary-button" onClick={() => { setSelected([]); setShowSetup(true); }} data-testid="begin-setup-button"><Sparkles size={15} /> Set up my subjects</button>
          </section>
        )}

        {showSetup && (
          <section className="setup-panel" data-testid="subject-setup-panel">
            <div className="eyebrow">{ready ? 'Make it yours' : 'First, your subjects'}</div>
            <h1 className="setup-heading">{ready ? 'Tune your subject list.' : 'What are you studying?'}</h1>
            <p className="setup-lead">Choose five or six distinct subjects. The A and E minimums set your personal grade bands; you can fine-tune them here or any time from your ledger.</p>
            <div className="setup-toolbar" data-testid="subject-selection-count">
              <span>{selected.length} of 5–6 subjects selected</span>
              <span>{selected.length < 5 ? `${5 - selected.length} more to choose` : selected.length > 6 ? 'Choose no more than six' : 'Ready when you are'}</span>
            </div>
            <div className="subject-options" data-testid="subject-options-list">
              {catalog.map((item) => {
                const checked = selected.includes(item.name);
                return <label className={`option-row${checked ? ' selected' : ''}`} key={item.name} data-testid={`subject-option-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleSubject(item.name)} aria-label={`Choose ${item.name}`} />
                  <span className="option-name">{item.name}</span>
                  <span className="option-threshold">A {item.a} · E {item.e}</span>
                </label>;
              })}
            </div>
            <div className="custom-row" data-testid="custom-subject-form">
              <input className="subject-name-input" value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="Add another subject" aria-label="Custom subject name" data-testid="custom-subject-name-input" />
              <input className="setup-threshold-input" type="number" min="0" max="100" value={customA} onChange={(event) => setCustomA(event.target.value)} aria-label="Custom subject A minimum" data-testid="custom-subject-a-input" />
              <input className="setup-threshold-input" type="number" min="0" max="100" value={customE} onChange={(event) => setCustomE(event.target.value)} aria-label="Custom subject E minimum" data-testid="custom-subject-e-input" />
              <button className="quiet-button" type="button" onClick={addCustom} data-testid="add-custom-subject-button">Add subject</button>
            </div>
            <div className="setup-actions">
              {ready ? <button className="quiet-button" onClick={() => setShowSetup(false)} data-testid="cancel-setup-button">Cancel</button> : <span className="threshold-hint">A minimum · E minimum</span>}
              <button className="primary-button" onClick={commitSetup} data-testid="save-subject-setup-button"><Check size={15} /> Save subjects</button>
            </div>
            {setupError && <p className="validation" role="alert" data-testid="setup-validation-message">{setupError}</p>}
            {ready && <div className="setup-actions"><button className="danger-button" onClick={() => setConfirm('reset')} data-testid="reset-from-setup-button"><Trash2 size={14} /> Clear all ledger data</button></div>}
          </section>
        )}

        {ready && !showSetup && <>
          <div className="intro-row">
            <div>
              <div className="eyebrow">Your marks, as they stand</div>
              <h1 className="page-title">A little progress adds up.</h1>
              <p className="page-subtitle">Keep each mark close. Your current grades update as you go.</p>
            </div>
            <div className="save-indicator" data-testid="save-status"><span className="save-dot" /> Saved on this device{savedAt ? ` · ${savedAt}` : ''}</div>
          </div>

          <section className="overview" aria-label="Overall progress" data-testid="overall-summary">
            <div className="overview-cell">
              <div className="overview-label">Current overall</div>
              <div className="overview-value" data-testid="overall-average-value">{fmt(average)}<small>{average === null ? 'waiting for a complete subject' : 'across complete subjects'}</small></div>
              <div className="overview-foot" data-testid="overall-completion-copy">{completed.length} of {subjects.length} subjects have a complete PA and terminal mark</div>
            </div>
            <div className="overview-cell">
              <div className="overview-label">Subjects in your ledger</div>
              <div className="overview-value" data-testid="subject-count-value">{subjects.length}<small>subjects</small></div>
              <div className="overview-foot">A personal view, just for you</div>
            </div>
            <div className="overview-cell">
              <div className="overview-label">Your next small step</div>
              <div className="overview-value" data-testid="next-step-value">{subjects.some((subject) => getFinal(subject) === null) ? 'Keep going' : 'All caught up'}</div>
              <div className="overview-foot">{subjects.some((subject) => getFinal(subject) === null) ? 'Add a mark whenever you have one' : 'Every subject has a current grade'}</div>
            </div>
          </section>

          <div className="section-head">
            <h2 className="section-title">Subject ledger</h2>
            <span className="section-note" data-testid="grading-method-note">PA 40% + terminal 60% · grades use your thresholds</span>
          </div>
          <section className="subject-list" aria-label="Subject grades" data-testid="subject-ledger-list">
            {subjects.map((subject, index) => {
              const pa = getPa(subject);
              const final = getFinal(subject);
              const progress = getProgress(subject);
              const isExpanded = expanded.includes(subject.id);
              const hasInvalidTest = subject.tests.some((test) => {
                const obtained = numeric(test.obtained), total = numeric(test.total);
                return obtained !== null && (!Number.isFinite(obtained) || obtained < 0) || total !== null && (!Number.isFinite(total) || total <= 0) ||
                  obtained !== null && total !== null && obtained > total;
              });
              const term = numeric(subject.terminal);
              const invalidTerminal = term !== null && (!Number.isFinite(term) || term < 0 || term > 100);
              const thresholdInvalid = subject.a <= subject.e || subject.a > 100 || subject.a < 0 || subject.e < 0 || subject.e > 100;
              return <article className="subject-card" key={subject.id} data-testid={`subject-card-${subject.id}`}>
                <div className="subject-top">
                  <div className="subject-name-wrap"><span className="subject-index">{String(index + 1).padStart(2, '0')}</span><h3 className="subject-name" data-testid={`subject-name-${subject.id}`}>{subject.name}</h3></div>
                  <div className="grade-wrap" data-testid={`grade-display-${subject.id}`}>
                    <div className={`grade-letter${final !== null ? ` grade-${gradeFor(final, subject).toLowerCase()}` : ''}`} data-testid={`grade-letter-${subject.id}`}>{final === null || thresholdInvalid ? '—' : gradeFor(final, subject)}</div>
                    <div className="grade-meta"><strong data-testid={`final-score-${subject.id}`}>{final === null ? '—' : fmt(final)}</strong><span>{final === null ? 'in progress' : 'current grade'}</span></div>
                  </div>
                </div>
                <div className="subject-body">
                  <div className="score-grid">
                    <section className="score-panel" aria-label={`${subject.name} PA test marks`}>
                      <div className="score-panel-head"><span className="score-label">PA tests</span><span className="score-weight">40% of final · average {fmt(pa)}</span></div>
                      <div className="tests-grid">
                        {subject.tests.map((test, testIndex) => <div className="test-item" key={testIndex} data-testid={`test-score-${subject.id}-${testIndex + 1}`}>
                          <span className="test-label">Test {testIndex + 1}</span>
                          <div className="mark-fields">
                            <input type="number" min="0" step="any" inputMode="decimal" value={test.obtained} onChange={(event) => updateTest(subject.id, testIndex, 'obtained', event.target.value)} placeholder="—" aria-label={`${subject.name} test ${testIndex + 1} mark achieved`} data-testid={`test-obtained-${subject.id}-${testIndex + 1}`} />
                            <span className="slash">/</span>
                            <input type="number" min="0.01" step="any" inputMode="decimal" value={test.total} onChange={(event) => updateTest(subject.id, testIndex, 'total', event.target.value)} placeholder="—" aria-label={`${subject.name} test ${testIndex + 1} total possible`} data-testid={`test-total-${subject.id}-${testIndex + 1}`} />
                            <span className="tiny-suffix">pts</span>
                          </div>
                        </div>)}
                      </div>
                    </section>
                    <section className="score-panel" aria-label={`${subject.name} terminal exam mark`}>
                      <div className="score-panel-head"><span className="score-label">Terminal exam</span><span className="score-weight">60% of final</span></div>
                      <div className="terminal-box">
                        <input className="terminal-input" type="number" min="0" max="100" step="any" inputMode="decimal" value={subject.terminal} onChange={(event) => updateSubject(subject.id, { terminal: event.target.value })} placeholder="—" aria-label={`${subject.name} terminal exam percentage`} data-testid={`terminal-score-${subject.id}`} />
                        <span>%</span>
                        <span className="threshold-hint">enter a percentage</span>
                      </div>
                    </section>
                  </div>
                  <div className="subject-bottom">
                    <div className="progress-copy" data-testid={`subject-progress-${subject.id}`}>
                      <span>{final !== null && !thresholdInvalid ? `Current grade ${gradeFor(final, subject)}` : `${progress.completed} of 5 mark sections complete`}</span>
                      <span className="progress-track"><span className="progress-fill" style={{ width: `${progress.completed / 5 * 100}%` }} /></span>
                    </div>
                    <button className="threshold-toggle" onClick={() => toggleThreshold(subject.id)} aria-expanded={isExpanded} data-testid={`threshold-toggle-${subject.id}`}>{thresholdInvalid ? 'Fix thresholds' : 'Grade thresholds'} <ChevronDown size={13} style={{ transform: isExpanded ? 'rotate(180deg)' : undefined }} /></button>
                  </div>
                  {(hasInvalidTest || invalidTerminal || thresholdInvalid) && <div className="validation" role="alert" data-testid={`score-validation-${subject.id}`}>{thresholdInvalid ? 'A minimum must be higher than E, and both must be between 0 and 100.' : hasInvalidTest ? 'Check this test: marks must be zero or more, and achieved cannot exceed the total.' : 'Terminal exam percentage must be between 0 and 100.'}</div>}
                </div>
                {isExpanded && <div className="threshold-panel" data-testid={`threshold-panel-${subject.id}`}>
                  <span className="threshold-title">Set this subject’s grade cut-offs</span>
                  <label className="threshold-entry">A minimum <input className="threshold-input" type="number" min="0" max="100" step="any" value={subject.a} onChange={(event) => updateSubject(subject.id, { a: Number(event.target.value) })} aria-label={`${subject.name} A grade minimum`} data-testid={`threshold-a-${subject.id}`} />%</label>
                  <label className="threshold-entry">E minimum <input className="threshold-input" type="number" min="0" max="100" step="any" value={subject.e} onChange={(event) => updateSubject(subject.id, { e: Number(event.target.value) })} aria-label={`${subject.name} E grade minimum`} data-testid={`threshold-e-${subject.id}`} />%</label>
                  <span className="threshold-hint">The space between is split evenly into B, C and D.</span>
                </div>}
              </article>;
            })}
          </section>
          <div className="footer-tools">
            <div className="tool-group">
              <button className="quiet-button" onClick={() => setConfirm('reconfigure')} data-testid="reconfigure-subjects-button"><Settings2 size={14} /> Subjects</button>
              <button className="quiet-button" onClick={exportBackup} data-testid="footer-export-backup-button"><Download size={14} /> Backup data</button>
              <button className="quiet-button" onClick={() => importRef.current?.click()} data-testid="footer-import-backup-button"><FileUp size={14} /> Restore backup</button>
              <button className="quiet-button" onClick={exportReport} data-testid="footer-export-report-button"><FileDown size={14} /> Grade report</button>
              <button className="quiet-button" onClick={() => setConfirm('reset')} data-testid="reset-ledger-button"><RotateCcw size={14} /> Reset</button>
            </div>
            <div className="foot-note"><ShieldCheck size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Your marks stay in this browser. Download a backup before changing devices.</div>
          </div>
          <section className="print-report" data-testid="print-friendly-report">
            <div className="eyebrow">Little ledger · AS grade report</div>
            <h1 className="page-title">My current grades</h1>
            <p className="page-subtitle">PA tests contribute 40%; the terminal exam contributes 60%.</p>
            <table><thead><tr><th>Subject</th><th>PA average</th><th>Terminal</th><th>Overall</th><th>Grade</th></tr></thead>
              <tbody>{subjects.map((subject) => {
                const final = getFinal(subject);
                return <tr key={subject.id}><td>{subject.name}</td><td>{fmt(getPa(subject))}</td><td>{subject.terminal ? `${subject.terminal}%` : '—'}</td><td>{fmt(final)}</td><td>{final === null ? 'In progress' : gradeFor(final, subject)}</td></tr>;
              })}</tbody></table>
          </section>
        </>}
      </main>

      {confirm && <div className="modal-backdrop" role="presentation" data-testid="confirmation-overlay">
        <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="confirmation-title" data-testid="confirmation-dialog">
          <h2 id="confirmation-title">{confirm === 'reset' ? 'Clear your grade ledger?' : 'Change your subject list?'}</h2>
          <p>{confirm === 'reset' ? 'This permanently removes your subjects, marks and thresholds from this browser. Download a backup first if you might want them later.' : 'You can add or remove subjects. Marks for subjects you keep will stay with them; removed subjects and their marks will no longer appear.'}</p>
          <div className="modal-actions">
            <button className="quiet-button" onClick={() => setConfirm(null)} data-testid="cancel-confirmation-button">Keep my data</button>
            <button className={confirm === 'reset' ? 'danger-button' : 'primary-button'} onClick={confirmAction} data-testid="confirm-destructive-action">{confirm === 'reset' ? 'Clear ledger' : 'Choose subjects'}</button>
          </div>
        </section>
      </div>}
      {toast && <div className="toast-message" role="status" data-testid="status-toast">{toast}</div>}
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  return <Home />;
}

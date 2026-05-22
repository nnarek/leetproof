"use client";

import '@/lib/lean4web/css/lean4web.css';

import { Provider, useAtom } from 'jotai';
import { LeanMonaco, LeanMonacoEditor } from 'lean4monaco';
import * as monaco from 'monaco-editor';
import { useCallback, useEffect, useRef, useState } from 'react';
import Split from 'react-split';

import { codeAtom, loadCodeForProblem, saveCodeForProblem, clearCodeForProblem } from '@/lib/lean4web/editor/code-atoms';
import { mobileAtom, settingsAtom } from '@/lib/lean4web/settings/settings-atoms';
import { SettingsPopup } from '@/lib/lean4web/settings/SettingsPopup';
import { screenWidthAtom } from '@/lib/lean4web/store/window-atoms';
import { save } from '@/lib/lean4web/utils/SaveToFile';
import { verifyProof } from '@/lib/lean-verify';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import type { Theme } from '@/lib/lean4web/settings/settings-types';
import { LEAN_VERSIONS, getWssUrl, getProjectFolder, type LeanVersion } from '@/lib/lean-versions';

interface Lean4EditorInnerProps {
  code?: string;
  problemId?: string;
  problemSlug?: string;
  mainTheoremName?: string;
  theoremType?: string;
  allowedAxioms?: string[];
  version: LeanVersion;
  onVersionChange: (v: LeanVersion) => void;
  pendingCode?: string | null;
}

export default function Lean4EditorInner({ code: initialCode, problemId, problemSlug, mainTheoremName, theoremType, allowedAxioms, version, onVersionChange, pendingCode }: Lean4EditorInnerProps) {
  return (
    <Provider>
      <Lean4EditorCore initialCode={initialCode} problemId={problemId} problemSlug={problemSlug} mainTheoremName={mainTheoremName} theoremType={theoremType} allowedAxioms={allowedAxioms} version={version} onVersionChange={onVersionChange} pendingCode={pendingCode} />
    </Provider>
  );
}

/** Read host app theme from data-theme attribute */
function getHostTheme(): 'light' | 'dark' {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

/** Map host theme to Monaco theme name */
function hostThemeToMonaco(hostTheme: 'light' | 'dark'): Theme {
  return hostTheme === 'light' ? 'Visual Studio Light' : 'Visual Studio Dark';
}

function buildVSCodeOptions(settings: { theme: string; wordWrap: boolean; acceptSuggestionOnEnter: boolean; showGoalNames: boolean; showExpectedType: boolean; abbreviationCharacter: string }) {
  return {
    'workbench.colorTheme': settings.theme,
    'editor.tabSize': 2,
    'editor.lightbulb.enabled': 'on',
    'editor.wordWrap': settings.wordWrap ? 'on' : 'off',
    'editor.wrappingStrategy': 'advanced',
    'editor.semanticHighlighting.enabled': true,
    'editor.acceptSuggestionOnEnter': settings.acceptSuggestionOnEnter ? 'on' : 'off',
    'lean4.input.eagerReplacementEnabled': true,
    'lean4.infoview.showGoalNames': settings.showGoalNames,
    'lean4.infoview.emphasizeFirstGoal': true,
    'lean4.infoview.showExpectedType': settings.showExpectedType,
    'lean4.infoview.showTooltipOnHover': false,
    'lean4.input.leader': settings.abbreviationCharacter,
  };
}

function Lean4EditorCore({ initialCode, problemId, problemSlug, mainTheoremName, theoremType, allowedAxioms, version, onVersionChange, pendingCode }: { initialCode?: string; problemId?: string; problemSlug?: string; mainTheoremName?: string; theoremType?: string; allowedAxioms?: string[]; version: LeanVersion; onVersionChange: (v: LeanVersion) => void; pendingCode?: string | null }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const infoviewRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor>();
  const leanMonacoRef = useRef<LeanMonaco | null>(null);
  const [settings, applySettings] = useAtom(settingsAtom);
  const [mobile] = useAtom(mobileAtom);
  const [, setScreenWidth] = useAtom(screenWidthAtom);
  const [code, setCode] = useAtom(codeAtom);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [versionMenuOpen, setVersionMenuOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { user } = useAuth();
  const versionBtnRef = useRef<HTMLDivElement>(null);

  const wssUrl = getWssUrl(version);
  const projectFolder = getProjectFolder(version);

  // Storage key for per-problem caching
  const storageId = problemId || problemSlug || '';
  console.debug('[LeetProof] Lean4EditorCore mounted', { problemId, problemSlug, storageId });

  // Sync theme from host app (data-theme attribute) → settings atom
  useEffect(() => {
    const syncTheme = () => {
      const monacoTheme = hostThemeToMonaco(getHostTheme());
      if (settings.theme !== monacoTheme) {
        applySettings({ ...settings, theme: monacoTheme });
      }
    };
    syncTheme();
    const obs = new MutationObserver(syncTheme);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, [settings, applySettings]);

  // Save screen width for mobile detection
  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setScreenWidth]);

  // Initialize Monaco + LeanMonaco ONCE (does not depend on settings)
  useEffect(() => {
    if (!editorRef.current || !infoviewRef.current) return;

    console.debug('[LeetProof] Starting editor');
    const _leanMonaco = new LeanMonaco();
    const _leanMonacoEditor = new LeanMonacoEditor();

    _leanMonaco.setInfoviewElement(infoviewRef.current);

    let disposed = false;

    (async () => {
      try {
        await _leanMonaco.start({
          websocket: { url: wssUrl },
          htmlElement: editorRef.current ?? undefined,
          vscode: buildVSCodeOptions(settings),
        });
        if (disposed) return;

        // Load per-problem saved code, fall back to starter code
        // If pendingCode is provided (from loading a submission/solution), use that instead
        const savedCode = storageId ? loadCodeForProblem(storageId) : '';
        const codeToUse = pendingCode || savedCode || initialCode || '';

        // Use a unique file name per problem to prevent Monaco model sharing
        // across different problems (avoids cross-contamination of saved code).
        const fileSlug = problemSlug || storageId || 'default';
        const fileName = `${projectFolder}/${fileSlug}.lean`;
        await _leanMonacoEditor.start(editorRef.current!, fileName, codeToUse);
        if (disposed) return;

        setEditor(_leanMonacoEditor.editor);
        setCode(codeToUse);
        leanMonacoRef.current = _leanMonaco;
        if (pendingCode && storageId) saveCodeForProblem(storageId, codeToUse);

        // Keep code atom + per-problem localStorage in sync with editor changes
        _leanMonacoEditor.editor?.onDidChangeModelContent(() => {
          if (disposed) return; // Don't persist during disposal
          const val = _leanMonacoEditor.editor?.getModel()?.getValue() ?? '';
          setCode(val);
          if (storageId) saveCodeForProblem(storageId, val);
        });

        // Go-to-definition: open docs link
        const editorService = (_leanMonacoEditor.editor as any)?._codeEditorService;
        if (editorService) {
          const openEditorBase = editorService.openCodeEditor.bind(editorService);
          editorService.openCodeEditor = async (input: any, source: any) => {
            const result = await openEditorBase(input, source);
            if (result === null) {
              let path = input.resource.path
                .replace(new RegExp('^.*/(?:lean|\.lake/packages/[^/]+/)'), '')
                .replace(new RegExp('\.lean$'), '');
              if (
                window.confirm(
                  `Do you want to open the docs?\n\n${path} (line ${input.options.selection.startLineNumber})`,
                )
              ) {
                const newTab = window.open(
                  `https://leanprover-community.github.io/mathlib4_docs/${path}.html`,
                  '_blank',
                );
                newTab?.focus();
              }
            }
            return null;
          };
        }
      } catch (err) {
        console.error('[LeetProof] Editor initialization error:', err);
      }
    })();

    return () => {
      disposed = true;
      leanMonacoRef.current = null;
      _leanMonacoEditor.dispose();
      _leanMonaco.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run once on mount
  }, []);

  // Update VSCode options when settings change (without restarting editor)
  useEffect(() => {
    if (leanMonacoRef.current) {
      leanMonacoRef.current.updateVSCodeOptions(buildVSCodeOptions(settings));
    }
  }, [settings]);

  // Ctrl+S: save file
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
    }
  }, []);

  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 's' &&
        code !== undefined
      ) {
        event.preventDefault();
        save(code);
      }
    },
    [code],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Listen for "load code into editor" events from SubmissionView/SolutionView
  useEffect(() => {
    const handleLoadCode = (e: Event) => {
      const code = (e as CustomEvent).detail?.code;
      if (code && editor) {
        const model = editor.getModel();
        if (!model) return;
        const fullRange = model.getFullModelRange();
        editor.pushUndoStop();
        editor.executeEdits('load-code', [{
          range: fullRange,
          text: code,
          forceMoveMarkers: true,
        }]);
        editor.pushUndoStop();
        setCode(code);
        if (storageId) saveCodeForProblem(storageId, code);
      }
    };
    window.addEventListener('leetproof:load-code', handleLoadCode);
    return () => window.removeEventListener('leetproof:load-code', handleLoadCode);
  }, [editor, setCode, storageId]);

  // Listen for hint code application events (uses executeEdits for undo support)
  useEffect(() => {
    const handleApplyHint = (e: Event) => {
      const newCode = (e as CustomEvent).detail?.code;
      if (typeof newCode === 'string' && editor) {
        const model = editor.getModel();
        if (!model) return;
        const fullRange = model.getFullModelRange();
        editor.pushUndoStop();
        editor.executeEdits('hint-apply', [{
          range: fullRange,
          text: newCode,
          forceMoveMarkers: true,
        }]);
        editor.pushUndoStop();
        setCode(newCode);
        if (storageId) saveCodeForProblem(storageId, newCode);
      }
    };
    window.addEventListener('leetproof:apply-hint-code', handleApplyHint);
    return () => window.removeEventListener('leetproof:apply-hint-code', handleApplyHint);
  }, [editor, setCode, storageId]);

  // Broadcast code changes to hints tab & respond to code requests
  useEffect(() => {
    if (!editor) return;
    const broadcastCode = () => {
      const val = editor.getModel()?.getValue() ?? '';
      window.dispatchEvent(new CustomEvent('leetproof:code-updated', { detail: { code: val } }));
    };
    const handleRequestCode = () => broadcastCode();
    window.addEventListener('leetproof:request-code', handleRequestCode);
    const disposable = editor.onDidChangeModelContent(() => broadcastCode());
    // Broadcast initial code
    broadcastCode();
    return () => {
      window.removeEventListener('leetproof:request-code', handleRequestCode);
      disposable.dispose();
    };
  }, [editor]);

  // Close version menu on outside click
  useEffect(() => {
    if (!versionMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (versionBtnRef.current && !versionBtnRef.current.contains(e.target as Node)) {
        setVersionMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [versionMenuOpen]);

  // Disable context menu outside editor
  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      const editorContainer = document.querySelector('.lean4web-root .codeview');
      if (editorContainer && !editorContainer.contains(event.target as Node)) {
        event.stopPropagation();
      }
    };
    document.addEventListener('contextmenu', handleContextMenu, true);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu, true);
    };
  }, []);

  // Build "Open in new tab" URL
  const openInNewTabUrl = (() => {
    const currentCode = code || initialCode || '';
    if (!currentCode) return 'https://live.lean-lang.org';
    const encoded = encodeURIComponent(currentCode);
    return `https://live.lean-lang.org/#code=${encoded}&project=${version}`;
  })();

  // Reset code to starter code
  const handleReset = useCallback(() => {
    if (!editor) return;
    if (!window.confirm('Reset code to the starter code? Your changes will be lost.')) return;
    const starter = initialCode || '';
    editor.getModel()?.setValue(starter);
    setCode(starter);
    if (storageId) clearCodeForProblem(storageId);
  }, [editor, initialCode, setCode, storageId]);

  // Handle proof submission (auto-name, no prompt)
  const handleSubmit = useCallback(async () => {
    if (!user) {
      setSubmitMessage({ type: 'error', text: 'Please sign in to submit your proof.' });
      return;
    }
    if (!problemId || !mainTheoremName) {
      setSubmitMessage({ type: 'error', text: 'Problem data not available.' });
      return;
    }
    if (!editor) {
      setSubmitMessage({ type: 'error', text: 'Editor not ready.' });
      return;
    }

    setSubmitting(true);
    setSubmitMessage(null);

    try {
      const result = await verifyProof(editor, mainTheoremName, {
        theoremType,
        allowedAxioms,
      });

      const supabase = createClient();
      const currentCode = editor.getModel()?.getValue() || '';

      // Count existing submissions to auto-generate name
      const { count } = await supabase
        .from('submissions')
        .select('id', { count: 'exact', head: true })
        .eq('problem_id', problemId)
        .eq('user_id', user.id);
      const nextNum = (count ?? 0) + 1;
      const autoName = `Submission ${nextNum}`;

      const status = result.valid ? 'accepted' : 'wrong';
      const { data: insertedData, error } = await supabase.from('submissions').insert({
        user_id: user.id,
        problem_id: problemId,
        code: currentCode,
        status,
        name: autoName,
        errors: result.valid ? null : (result.error || null),
        version,
      }).select('*').single();

      if (error) {
        setSubmitMessage({ type: 'error', text: `Failed to save: ${error.message}` });
      } else {
        // Silently open the new submission
        setSubmitMessage(null);
        window.dispatchEvent(new CustomEvent("leetproof:submission-created", { detail: insertedData }));
      }
    } catch (err) {
      setSubmitMessage({ type: 'error', text: `Verification failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setSubmitting(false);
    }
  }, [user, problemId, mainTheoremName, theoremType, allowedAxioms, editor, version]);

  return (
    <div className="lean4web-root monaco-workbench">
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--surface)',
          padding: '4px 12px',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--foreground)' }}>
          {/* Lean 4 Editor */}
        </span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {problemId && mainTheoremName && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="vscode-menu-btn"
              style={submitting ? { opacity: 0.6, cursor: 'not-allowed' } : { background: '#0078d4', color: '#fff' }}
              title={user ? 'Submit your proof for verification' : 'Sign in to submit'}
            >
              {submitting ? 'Verifying...' : 'Submit'}
            </button>
          )}
          <button
            onClick={() => leanMonacoRef.current?.restart()}
            className="vscode-menu-btn"
            title="Restart Lean server"
          >
            Restart
          </button>
          <button
            onClick={handleReset}
            className="vscode-menu-btn"
            title="Reset to starter code"
          >
            Reset
          </button>
          <div ref={versionBtnRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setVersionMenuOpen(!versionMenuOpen)}
              className="vscode-menu-btn"
              title="Mathlib version"
            >
              {LEAN_VERSIONS.find(v => v.value === version)?.label ?? version}
            </button>
            {versionMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',

                  marginTop: '4px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--surface)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  zIndex: 100,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
              >
                {LEAN_VERSIONS.map(v => (
                  <button
                    key={v.value}
                    onClick={() => { onVersionChange(v.value); setVersionMenuOpen(false); }}
                    className="vscode-menu-btn"
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'center',
                      borderRadius: 0,
                      padding: '6px 8px',
                      fontWeight: v.value === version ? 600 : 400,
                      color: v.value === version ? 'var(--accent)' : 'var(--foreground)',
                    }}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="vscode-menu-btn"
            title="Editor Settings"
          >
            Settings
          </button>
          <a
            href={openInNewTabUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="vscode-menu-btn"
            title="Open in lean4web"
          >
            Open↗
          </a>
        </div>
      </div>

      {/* Submit status message */}
      {submitMessage && (
        <div
          style={{
            padding: '6px 12px',
            fontSize: '0.8rem',
            fontWeight: 500,
            backgroundColor: submitMessage.type === 'success' ? 'var(--success-bg, #d1fae5)' : 'var(--error-bg, #fee2e2)',
            color: submitMessage.type === 'success' ? 'var(--success-fg, #065f46)' : 'var(--error-fg, #991b1b)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{submitMessage.text}</span>
          <button
            onClick={() => setSubmitMessage(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'inherit' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Editor + Infoview split */}
      <Split
        className={`editor ${dragging ? 'dragging' : ''}`}
        gutter={(_index, _direction) => {
          const gutter = document.createElement('div');
          gutter.className = 'gutter';
          return gutter;
        }}
        gutterStyle={(_dimension, gutterSize, _index) => {
          return {
            width: mobile ? '100%' : `${gutterSize}px`,
            height: mobile ? `${gutterSize}px` : '100%',
            cursor: mobile ? 'row-resize' : 'col-resize',
            'margin-left': mobile ? 0 : `-${gutterSize}px`,
            'margin-top': mobile ? `-${gutterSize}px` : 0,
            'z-index': 0,
          } as any;
        }}
        gutterSize={5}
        onDragStart={() => setDragging(true)}
        onDragEnd={() => setDragging(false)}
        sizes={mobile ? [50, 50] : [65, 35]}
        direction={mobile ? 'vertical' : 'horizontal'}
        style={{ flexDirection: mobile ? 'column' : 'row' }}
      >
        <div className="codeview-wrapper" style={mobile ? { width: '100%' } : { height: '100%' }}>
          <div ref={editorRef} className="codeview" />
        </div>
        <div
          ref={infoviewRef}
          className="vscode-light infoview"
          style={mobile ? { width: '100%' } : { height: '100%' }}
        />
      </Split>

      {/* Settings popup */}
      <SettingsPopup
        open={settingsOpen}
        handleClose={() => setSettingsOpen(false)}
        closeNav={() => {}}
      />
    </div>
  );
}

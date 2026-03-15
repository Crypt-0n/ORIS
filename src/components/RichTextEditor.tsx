import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { api } from '../lib/api';

interface MentionUser {
  id: string;
  full_name: string;
}

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function RichTextEditor({ value, onChange, placeholder, disabled = false }: RichTextEditorProps) {
  const [showMention, setShowMention] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionPos, setMentionPos] = useState({ top: 0, left: 0 });
  const quillRef = useRef<ReactQuill>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mentionStartRef = useRef<number>(-1);
  const listenerAttachedRef = useRef(false);

  // Fetch users once
  useEffect(() => {
    api.get('/auth/users-list').then((data: unknown) => {
      if (Array.isArray(data)) setMentionUsers(data);
    }).catch(() => {});
  }, []);

  // Build filtered suggestions
  const suggestions = useMemo(() => {
    const q = mentionQuery.toLowerCase();
    const caseOption: MentionUser = { id: '__case__', full_name: 'case' };
    const filtered = mentionUsers.filter(u =>
      u.full_name.toLowerCase().includes(q)
    );
    const all = [caseOption, ...filtered];
    return q ? all.filter(u => u.full_name.toLowerCase().includes(q)) : all;
  }, [mentionQuery, mentionUsers]);

  const insertMention = useCallback((user: MentionUser) => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const start = mentionStartRef.current;
    if (start < 0) return;

    const sel = quill.getSelection();
    const cursorPos = sel?.index ?? (start + mentionQuery.length + 1);
    const deleteLen = cursorPos - start;
    quill.deleteText(start, deleteLen);
    const mentionText = `@${user.full_name}`;
    // Insert mention with blue bold formatting
    quill.insertText(start, mentionText, { bold: true, color: '#3b82f6' });
    // Insert a space with NO formatting to reset the cursor style
    const afterMention = start + mentionText.length;
    quill.insertText(afterMention, ' ', { bold: false, color: false });
    // Remove any residual format at the cursor position
    quill.removeFormat(afterMention, 1);
    quill.insertText(afterMention, ' ');
    quill.deleteText(afterMention + 1, 1);
    quill.setSelection(afterMention + 1, 0);

    setShowMention(false);
    setMentionQuery('');
    mentionStartRef.current = -1;
  }, [mentionQuery]);

  // Handle keydown for mention navigation (capture phase)
  useEffect(() => {
    if (!showMention) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, suggestions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (suggestions.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          insertMention(suggestions[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowMention(false);
        mentionStartRef.current = -1;
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [showMention, suggestions, selectedIndex, insertMention]);

  // Callback to check for @ mention in the editor
  const checkForMention = useCallback(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const sel = quill.getSelection();
    if (!sel) {
      setShowMention(false);
      return;
    }

    const cursorPos = sel.index;
    const fullText = quill.getText();
    const textBeforeCursor = fullText.substring(0, cursorPos);

    const atIndex = textBeforeCursor.lastIndexOf('@');
    if (atIndex >= 0) {
      const charBefore = atIndex > 0 ? textBeforeCursor[atIndex - 1] : ' ';
      if (atIndex === 0 || /\s/.test(charBefore)) {
        const query = textBeforeCursor.substring(atIndex + 1);
        if (!query.includes('\n') && query.length < 30) {
          mentionStartRef.current = atIndex;
          setMentionQuery(query);
          setSelectedIndex(0);

          try {
            const bounds = quill.getBounds(atIndex);
            const qlContainer = containerRef.current?.querySelector('.ql-container') as HTMLElement;
            const containerOffset = qlContainer ? qlContainer.offsetTop : 42;
            if (bounds) {
              setMentionPos({
                top: containerOffset + bounds.top + bounds.height + 4,
                left: bounds.left + 12,
              });
            }
          } catch {}

          setShowMention(true);
          return;
        }
      }
    }

    setShowMention(false);
    mentionStartRef.current = -1;
  }, []);

  // Use Quill's own event system via the ref - attach after component mounts
  // This is called on every render to handle the case where quillRef becomes available
  useEffect(() => {
    if (listenerAttachedRef.current) return;

    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const editorRoot = quill.root; // This is the contenteditable .ql-editor element
    if (!editorRoot) return;

    const handler = () => {
      setTimeout(checkForMention, 10);
    };

    editorRoot.addEventListener('keyup', handler);
    editorRoot.addEventListener('mouseup', handler);
    listenerAttachedRef.current = true;

    return () => {
      editorRoot.removeEventListener('keyup', handler);
      editorRoot.removeEventListener('mouseup', handler);
      listenerAttachedRef.current = false;
    };
  }); // No deps - runs on every render until attached

  const modules = useMemo(() => ({
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'color': [] }, { 'background': [] }],
      ['link', 'code-block'],
      ['clean']
    ],
  }), []);

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'color', 'background',
    'link', 'code-block'
  ];

  return (
    <div
      ref={containerRef}
      className={`rich-text-editor relative ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
    >
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        readOnly={disabled}
      />

      {showMention && suggestions.length > 0 && (
        <div
          className="absolute z-50 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-2xl overflow-hidden"
          style={{ top: mentionPos.top, left: mentionPos.left, minWidth: 220, maxHeight: 200 }}
        >
          <div className="overflow-y-auto max-h-[200px]">
            {suggestions.map((user, i) => (
              <button
                key={user.id}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors
                  ${i === selectedIndex
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(user);
                }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                {user.id === '__case__' ? (
                  <>
                    <span className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xs">📢</span>
                    <span className="font-medium">@case</span>
                    <span className="text-xs text-gray-400 dark:text-slate-500 ml-auto">Tout le dossier</span>
                  </>
                ) : (
                  <>
                    <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-medium text-blue-700 dark:text-blue-300">
                      {user.full_name.charAt(0)}
                    </span>
                    <span>{user.full_name}</span>
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

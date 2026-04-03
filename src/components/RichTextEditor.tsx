import { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Mention from '@tiptap/extension-mention';
import Placeholder from '@tiptap/extension-placeholder';
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import { api } from '../lib/api';
import { 
  Bold, Italic, Strikethrough, Code, List, ListOrdered,
  Heading1, Heading2, Heading3, Quote, Minus, Undo, Redo
} from 'lucide-react';

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 rounded-t-lg">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={`p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-slate-700 transition ${editor.isActive('bold') ? 'bg-gray-200 dark:bg-slate-700 text-cyan-600 dark:text-cyan-400' : 'text-gray-600 dark:text-slate-400'}`}
        title="Gras"
      >
         <Bold className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={`p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-slate-700 transition ${editor.isActive('italic') ? 'bg-gray-200 dark:bg-slate-700 text-cyan-600 dark:text-cyan-400' : 'text-gray-600 dark:text-slate-400'}`}
        title="Italique"
      >
         <Italic className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        className={`p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-slate-700 transition ${editor.isActive('strike') ? 'bg-gray-200 dark:bg-slate-700 text-cyan-600 dark:text-cyan-400' : 'text-gray-600 dark:text-slate-400'}`}
        title="Barré"
      >
         <Strikethrough className="w-4 h-4" />
      </button>
      <div className="w-px h-6 bg-gray-300 dark:bg-slate-600 mx-1 self-center" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCode().run()}
        disabled={!editor.can().chain().focus().toggleCode().run()}
        className={`p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-slate-700 transition ${editor.isActive('code') ? 'bg-gray-200 dark:bg-slate-700 text-cyan-600 dark:text-cyan-400' : 'text-gray-600 dark:text-slate-400'}`}
        title="Code en ligne"
      >
         <Code className="w-4 h-4" />
      </button>
      <div className="w-px h-6 bg-gray-300 dark:bg-slate-600 mx-1 self-center" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-slate-700 transition ${editor.isActive('bulletList') ? 'bg-gray-200 dark:bg-slate-700 text-cyan-600 dark:text-cyan-400' : 'text-gray-600 dark:text-slate-400'}`}
        title="Liste à puces"
      >
         <List className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-slate-700 transition ${editor.isActive('orderedList') ? 'bg-gray-200 dark:bg-slate-700 text-cyan-600 dark:text-cyan-400' : 'text-gray-600 dark:text-slate-400'}`}
        title="Liste numérotée"
      >
         <ListOrdered className="w-4 h-4" />
      </button>
      
      <div className="w-px h-6 bg-gray-300 dark:bg-slate-600 mx-1 self-center" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={`p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-slate-700 transition ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-200 dark:bg-slate-700 text-cyan-600 dark:text-cyan-400' : 'text-gray-600 dark:text-slate-400'}`}
        title="Titre 1"
      >
         <Heading1 className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-slate-700 transition ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200 dark:bg-slate-700 text-cyan-600 dark:text-cyan-400' : 'text-gray-600 dark:text-slate-400'}`}
        title="Titre 2"
      >
         <Heading2 className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={`p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-slate-700 transition ${editor.isActive('heading', { level: 3 }) ? 'bg-gray-200 dark:bg-slate-700 text-cyan-600 dark:text-cyan-400' : 'text-gray-600 dark:text-slate-400'}`}
        title="Titre 3"
      >
         <Heading3 className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-gray-300 dark:bg-slate-600 mx-1 self-center" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={`p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-slate-700 transition ${editor.isActive('blockquote') ? 'bg-gray-200 dark:bg-slate-700 text-cyan-600 dark:text-cyan-400' : 'text-gray-600 dark:text-slate-400'}`}
        title="Citation"
      >
         <Quote className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className={`p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-slate-700 transition text-gray-600 dark:text-slate-400`}
        title="Séparateur"
      >
         <Minus className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-gray-300 dark:bg-slate-600 mx-1 self-center" />
      <button
        type="button"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().chain().focus().undo().run()}
        className={`p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-slate-700 transition text-gray-600 dark:text-slate-400 disabled:opacity-50`}
        title="Annuler"
      >
         <Undo className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().chain().focus().redo().run()}
        className={`p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-slate-700 transition text-gray-600 dark:text-slate-400 disabled:opacity-50`}
        title="Rétablir"
      >
         <Redo className="w-4 h-4" />
      </button>
    </div>
  );
};

interface MentionUser {
  id: string;
  full_name: string;
}

interface MentionListProps {
  items: MentionUser[];
  command: (item: { id: string; label: string }) => void;
}

const MentionList = forwardRef((props: MentionListProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command({ id: item.id, label: item.full_name });
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }
      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }
      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }
      return false;
    },
  }));

  if (!props.items.length) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-2xl overflow-hidden min-w-[220px] max-h-[200px] overflow-y-auto z-50">
      {props.items.map((item, index) => (
        <button
          className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
            index === selectedIndex ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
          }`}
          key={item.id}
          onClick={() => selectItem(index)}
        >
          {item.id === '__case__' ? (
            <>
              <span className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xs">📢</span>
              <span className="font-medium">@case</span>
              <span className="text-xs text-gray-500 dark:text-slate-400 ml-auto">Tout le dossier</span>
            </>
          ) : (
            <>
              <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-medium text-blue-700 dark:text-blue-300">
                {(item.full_name || '?').charAt(0).toUpperCase()}
              </span>
              <span>{item.full_name || 'Utilisateur inconnu'}</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
});

MentionList.displayName = 'MentionList';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function RichTextEditor({ value, onChange, placeholder, disabled = false }: RichTextEditorProps) {
  const [users, setUsers] = useState<MentionUser[]>([]);

  useEffect(() => {
    api.get('/auth/users-list').then((data: unknown) => {
      if (Array.isArray(data)) {
        setUsers([{ id: '__case__', full_name: 'case' }, ...data]);
      }
    }).catch(() => {});
  }, []);

  const suggestion = {
    items: ({ query }: { query: string }) => {
      return users.filter((item) => (item.full_name || '').toLowerCase().includes(query.toLowerCase())).slice(0, 10);
    },
    render: () => {
      let reactRenderer: any;
      let popup: any[];

      return {
        onStart: (props: any) => {
          if (!props.clientRect) {
            return;
          }
          reactRenderer = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          });

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: reactRenderer.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
          });
        },
        onUpdate(props: any) {
          reactRenderer?.updateProps(props);

          if (!props.clientRect) {
            return;
          }

          popup?.[0].setProps({
            getReferenceClientRect: props.clientRect,
          });
        },
        onKeyDown(props: any) {
          if (props.event.key === 'Escape') {
            popup?.[0].hide();
            return true;
          }
          return reactRenderer?.ref?.onKeyDown(props);
        },
        onExit() {
          popup?.[0].destroy();
          reactRenderer?.destroy();
        },
      };
    },
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      Link.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Saisissez votre texte...',
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'mention bg-blue-100 text-blue-800 font-semibold px-1 rounded-sm cursor-pointer',
        },
        suggestion,
      }),
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base dark:prose-invert focus:outline-none max-w-none min-h-[120px] p-4 bg-white dark:bg-slate-900 dark:text-slate-200 rounded-b-lg',
      },
    },
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== value) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className={`tiptap-editor border border-gray-200 dark:border-slate-700 rounded-lg flex flex-col focus-within:ring-2 focus-within:ring-cyan-500/50 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <MenuBar editor={editor} />
      <EditorContent editor={editor} className="flex-1" />
    </div>
  );
}

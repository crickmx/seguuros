import { useState, useRef, useEffect } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

type FormatCommand = 'bold' | 'italic' | 'underline' | 'insertUnorderedList' | 'insertOrderedList' | 'createLink';

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const executeCommand = (command: FormatCommand) => {
    if (command === 'createLink') {
      const url = prompt('Ingresa la URL:');
      if (url) {
        document.execCommand('createLink', false, url);
      }
    } else {
      document.execCommand(command, false);
    }
    editorRef.current?.focus();
  };

  const toolbarButtons = [
    { command: 'bold' as const, icon: 'B', title: 'Negrita', style: { fontWeight: 700 } },
    { command: 'italic' as const, icon: 'I', title: 'Cursiva', style: { fontStyle: 'italic' } },
    { command: 'underline' as const, icon: 'U', title: 'Subrayado', style: { textDecoration: 'underline' } },
    { command: 'insertUnorderedList' as const, icon: '•', title: 'Lista con viñetas' },
    { command: 'insertOrderedList' as const, icon: '1.', title: 'Lista numerada' },
    { command: 'createLink' as const, icon: '🔗', title: 'Insertar enlace' },
  ];

  return (
    <div style={{
      border: `1px solid ${isFocused ? '#65EA1E' : '#E6E8EF'}`,
      borderRadius: '8px',
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      <div style={{
        display: 'flex',
        gap: '4px',
        padding: '8px',
        borderBottom: '1px solid #E6E8EF',
        background: '#F9FAFB',
        flexWrap: 'wrap',
      }}>
        {toolbarButtons.map((btn) => (
          <button
            key={btn.command}
            type="button"
            onClick={() => executeCommand(btn.command)}
            title={btn.title}
            style={{
              width: '32px',
              height: '32px',
              border: '1px solid #E6E8EF',
              borderRadius: '4px',
              background: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              color: '#202856',
              transition: 'all 0.2s',
              ...btn.style,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#F3F4F6';
              e.currentTarget.style.borderColor = '#65EA1E';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#FFFFFF';
              e.currentTarget.style.borderColor = '#E6E8EF';
            }}
          >
            {btn.icon}
          </button>
        ))}
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{
          minHeight: '200px',
          padding: '12px',
          outline: 'none',
          fontSize: '14px',
          lineHeight: '1.6',
          color: '#202856',
        }}
        data-placeholder={placeholder}
      />
      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9CA3AF;
          pointer-events: none;
        }
        [contenteditable] a {
          color: #65EA1E;
          text-decoration: underline;
        }
        [contenteditable] ul, [contenteditable] ol {
          padding-left: 24px;
          margin: 8px 0;
        }
        [contenteditable] li {
          margin: 4px 0;
        }
      `}</style>
    </div>
  );
}
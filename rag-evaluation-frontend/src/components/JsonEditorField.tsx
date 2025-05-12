import React, { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';

const JsonEditorField: React.FC<{
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  height?: number;
}> = ({ value, onChange, placeholder, height = 120 }) => {
  const [text, setText] = useState(value || '');
  const [error, setError] = useState(false);

  useEffect(() => {
    setText(value || '');
  }, [value]);

  useEffect(() => {
    try {
      if (text.trim()) JSON.parse(text);
      setError(false);
    } catch {
      setError(true);
    }
  }, [text]);

  return (
    <div style={{ background: '#fafafa', border: error ? '1px solid #ff4d4f' : '1px solid #d9d9d9', borderRadius: 4, padding: 4, minHeight: height }}>
      <CodeMirror
        value={text}
        extensions={[json()]}
        onChange={(val) => {
          setText(val);
          onChange && onChange(val);
        }}
        placeholder={placeholder}
        basicSetup={{
          lineNumbers: false,
          highlightActiveLine: false,
        }}
        style={{ fontSize: 14, fontFamily: 'monospace', background: '#fafafa' }}
      />
      {/* {error && <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>请输入有效的JSON格式</div>} */}
      {!text && <div style={{ color: '#aaa', fontSize: 12, marginTop: 4 }}>{placeholder}</div>}
    </div>
  );
};

export default JsonEditorField;


import React from 'react';
import ReactJson from 'react-json-view';

const JsonEditorField: React.FC<{
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  height?: number;
}> = ({ value, onChange, placeholder, height = 120 }) => {
  let json: any = {};
  let error = false;
  try {
    json = value ? JSON.parse(value) : {};
  } catch {
    error = true;
  }
  return (
    <div style={{ border: error ? '1px solid #ff4d4f' : '1px solid #d9d9d9', borderRadius: 4, padding: 4, background: '#fafafa', minHeight: height }}>
      <ReactJson
        src={json}
        name={false}
        displayDataTypes={false}
        displayObjectSize={false}
        enableClipboard={false}
        style={{ fontSize: 13, background: 'transparent' }}
        onEdit={e => onChange && onChange(JSON.stringify(e.updated_src, null, 2))}
        onAdd={e => onChange && onChange(JSON.stringify(e.updated_src, null, 2))}
        onDelete={e => onChange && onChange(JSON.stringify(e.updated_src, null, 2))}
        collapsed={false}
      />
      {error && <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>请输入有效的JSON格式</div>}
      {!value && <div style={{ color: '#aaa', fontSize: 12, marginTop: 4 }}>{placeholder}</div>}
    </div>
  );
};

export default JsonEditorField; 
'use client';

import { Upload } from 'lucide-react';
import { useId, useState, type InputHTMLAttributes, type Ref } from 'react';

type FileUploadFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  guidance: string;
  inputRef?: Ref<HTMLInputElement>;
  error?: string;
  selectedFileName?: string;
};

export function FileUploadField({ label, guidance, inputRef, error, selectedFileName, onChange, multiple, disabled, ...props }: FileUploadFieldProps) {
  const id = useId();
  const [localName, setLocalName] = useState('');
  const filename = selectedFileName ?? localName;

  return <div className="cc-upload-field" data-invalid={Boolean(error)} data-disabled={Boolean(disabled)}>
    <label htmlFor={id} className="cc-upload-label">{label}</label>
    <label htmlFor={id} className="cc-upload-control">
      <input {...props} id={id} ref={inputRef} type="file" multiple={multiple} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`} onChange={event => {
        const names = Array.from(event.target.files ?? []).map(file => file.name);
        setLocalName(names.join(', '));
        onChange?.(event);
      }} />
      <span className="cc-upload-button"><Upload size={16} aria-hidden="true" />Choose {multiple ? 'files' : 'file'}</span>
      <span className="cc-upload-filename" title={filename || undefined}>{filename || 'No file selected'}</span>
    </label>
    <small id={`${id}-help`} className="cc-upload-help">{guidance}</small>
    {error ? <small id={`${id}-error`} className="cc-upload-error" role="alert">{error}</small> : null}
  </div>;
}

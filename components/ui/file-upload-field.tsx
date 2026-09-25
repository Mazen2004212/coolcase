'use client';
import { useId, type InputHTMLAttributes, type Ref } from 'react';
export function FileUploadField({ label, guidance, inputRef, ...props }: InputHTMLAttributes<HTMLInputElement> & { label:string; guidance:string; inputRef?:Ref<HTMLInputElement> }) {
  const id=useId();
  return <><label htmlFor={id}><span>{label}</span><input {...props} id={id} ref={inputRef} type="file" aria-describedby={`${id}-help`}/></label><small id={`${id}-help`}>{guidance}</small></>;
}

import React from 'react';

export default function Shuffle({ text, className, style, tag: Tag = 'span' }) {
  return <Tag className={className} style={style}>{text}</Tag>;
}

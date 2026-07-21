import { useEffect, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useModalStore } from '../stores/modal.ts';

const COLOR_BADGES = [
  { cls: 'color-default', value: '', title: 'Default' },
  { cls: 'color-red', value: '#ef4444', title: 'Red' },
  { cls: 'color-orange', value: '#f97316', title: 'Orange' },
  { cls: 'color-yellow', value: '#eab308', title: 'Yellow' },
  { cls: 'color-green', value: '#22c55e', title: 'Green' },
  { cls: 'color-blue', value: '#3b82f6', title: 'Blue' },
  { cls: 'color-purple', value: '#a855f7', title: 'Purple' },
  { cls: 'color-pink', value: '#ec4899', title: 'Pink' },
];

const ICON_BADGES = [
  { icon: 'default', label: 'Default' },
  { icon: 'code', label: 'Code' },
  { icon: 'document', label: 'Doc' },
  { icon: 'star', label: 'Star' },
  { icon: 'heart', label: 'Fav' },
  { icon: 'lock', label: 'Private' },
];

export function ModalHost() {
  const active = useModalStore((s) => s.active);
  const submit = useModalStore((s) => s.submit);
  const cancel = useModalStore((s) => s.cancel);

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [color, setColor] = useState('');
  const [icon, setIcon] = useState('default');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!active) return;
    setTitle(active.fieldsVal?.title ?? '');
    setUrl(active.fieldsVal?.url ?? '');
    setColor(active.fieldsVal?.color ?? '');
    setIcon(active.fieldsVal?.icon ?? 'default');
    setError('');
  }, [active]);

  if (!active) return null;

  const mode = active.mode ?? (active.message ? 'confirm' : 'input');
  const fields = active.showFields ?? [];

  const onSubmit = () => {
    if (mode === 'confirm' || mode === 'alert') {
      submit(true);
      return;
    }
    if (fields.includes('folderStyle')) {
      submit({ color, icon });
      return;
    }
    const nextTitle = title.trim();
    let nextUrl = url.trim();
    if (fields.includes('title') && nextTitle === '') {
      setError('Name cannot be empty.');
      return;
    }
    if (fields.includes('url')) {
      if (nextUrl === '') {
        setError('URL cannot be empty.');
        return;
      }
      if (!/^[a-zA-Z0-9+-.]+:\/\//.test(nextUrl)) {
        nextUrl = `https://${nextUrl}`;
      }
    }
    submit({ title: nextTitle, url: nextUrl });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onSubmit();
    }
  };

  return createPortal(
    <div className="modal-overlay" style={{ display: 'flex' }}>
      <div className="modal-card">
        <h3>{active.title}</h3>
        <div className="modal-fields">
          {active.message && <p className="modal-confirm-text">{active.message}</p>}

          {mode === 'input' && fields.includes('title') && (
            <div className="field-group">
              <label htmlFor="modal-input-title">Name</label>
              <input
                id="modal-input-title"
                type="text"
                placeholder="Enter name..."
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={onKeyDown}
              />
            </div>
          )}

          {mode === 'input' && fields.includes('url') && (
            <div className="field-group">
              <label htmlFor="modal-input-url">URL</label>
              <input
                id="modal-input-url"
                type="text"
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={onKeyDown}
              />
            </div>
          )}

          {mode === 'input' && fields.includes('folderStyle') && (
            <div className="field-group">
              <label>Folder Color</label>
              <div className="color-picker-row">
                {COLOR_BADGES.map((badge) => (
                  <span
                    key={badge.cls}
                    className={`color-badge ${badge.cls}${color === badge.value ? ' selected' : ''}`}
                    title={badge.title}
                    onClick={() => setColor(badge.value)}
                  />
                ))}
              </div>
              <label style={{ marginTop: '10px' }}>Folder Icon</label>
              <div className="icon-picker-row">
                {ICON_BADGES.map((badge) => (
                  <span
                    key={badge.icon}
                    className={`icon-badge${icon === badge.icon ? ' selected' : ''}`}
                    title={badge.label}
                    onClick={() => setIcon(badge.icon)}
                  >
                    {badge.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {error && <p className="modal-error-text">{error}</p>}
        </div>
        <div className="modal-actions">
          {mode !== 'alert' && (
            <button className="modal-btn secondary" onClick={cancel}>
              {active.cancelLabel ?? 'Cancel'}
            </button>
          )}
          <button className="modal-btn primary" onClick={onSubmit}>
            {active.submitLabel ?? (mode === 'input' ? 'Save' : 'OK')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useModalStore } from '../stores/modal.ts';
import { t } from '../lib/i18n.ts';
import type { MessageKey } from '../lib/message-catalog.ts';

const COLOR_BADGES: { cls: string; value: string; titleKey: MessageKey }[] = [
  { cls: 'color-default', value: '', titleKey: 'common_default' },
  { cls: 'color-red', value: '#ef4444', titleKey: 'color_red' },
  { cls: 'color-orange', value: '#f97316', titleKey: 'color_orange' },
  { cls: 'color-yellow', value: '#eab308', titleKey: 'color_yellow' },
  { cls: 'color-green', value: '#22c55e', titleKey: 'color_green' },
  { cls: 'color-blue', value: '#3b82f6', titleKey: 'color_blue' },
  { cls: 'color-purple', value: '#a855f7', titleKey: 'color_purple' },
  { cls: 'color-pink', value: '#ec4899', titleKey: 'color_pink' },
];

const ICON_BADGES: { icon: string; labelKey: MessageKey }[] = [
  { icon: 'default', labelKey: 'common_default' },
  { icon: 'code', labelKey: 'icon_code' },
  { icon: 'document', labelKey: 'icon_document' },
  { icon: 'star', labelKey: 'icon_star' },
  { icon: 'heart', labelKey: 'icon_heart' },
  { icon: 'lock', labelKey: 'icon_lock' },
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
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    setTitle(active.fieldsVal?.title ?? '');
    setUrl(active.fieldsVal?.url ?? '');
    setColor(active.fieldsVal?.color ?? '');
    setIcon(active.fieldsVal?.icon ?? 'default');
    setError('');
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => {
      const card = cardRef.current;
      if (!card || card.contains(document.activeElement)) return;
      card.querySelector<HTMLElement>('input, .modal-btn.primary, button')?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
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
      setError(t('modal_name_required'));
      return;
    }
    if (fields.includes('url')) {
      if (nextUrl === '') {
        setError(t('modal_url_required'));
        return;
      }
      if (!/^[a-zA-Z0-9+-.]+:\/\//.test(nextUrl)) {
        nextUrl = `https://${nextUrl}`;
      }
    }
    submit({ title: nextTitle, url: nextUrl });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancel();
      return;
    }
    if (event.key === 'Tab') {
      const focusable = [...(cardRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? [])];
      if (focusable.length > 0) {
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
      return;
    }
    if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      onSubmit();
    }
  };

  return createPortal(
    <div className="modal-overlay" style={{ display: 'flex' }}>
      <div
        ref={cardRef}
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="widemark-modal-title"
        aria-describedby={active.message ? 'widemark-modal-description' : undefined}
        onKeyDown={onKeyDown}
      >
        <h3 id="widemark-modal-title">{active.title}</h3>
        <div className="modal-fields">
          {active.message && <p id="widemark-modal-description" className="modal-confirm-text">{active.message}</p>}

          {mode === 'input' && fields.includes('title') && (
            <div className="field-group">
              <label htmlFor="modal-input-title">{t('modal_name')}</label>
              <input
                id="modal-input-title"
                type="text"
                placeholder={t('modal_name_placeholder')}
                autoFocus
                value={title}
                aria-invalid={error ? true : undefined}
                aria-errormessage={error ? 'widemark-modal-error' : undefined}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          )}

          {mode === 'input' && fields.includes('url') && (
            <div className="field-group">
              <label htmlFor="modal-input-url">{t('modal_url')}</label>
              <input
                id="modal-input-url"
                type="text"
                placeholder="https://..."
                value={url}
                aria-invalid={error ? true : undefined}
                aria-errormessage={error ? 'widemark-modal-error' : undefined}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
          )}

          {mode === 'input' && fields.includes('folderStyle') && (
            <div className="field-group">
              <label>{t('modal_folder_color')}</label>
              <div className="color-picker-row">
                {COLOR_BADGES.map((badge) => (
                  <button
                    type="button"
                    key={badge.cls}
                    className={`color-badge ${badge.cls}${color === badge.value ? ' selected' : ''}`}
                    title={t(badge.titleKey)}
                    aria-label={t(badge.titleKey)}
                    aria-pressed={color === badge.value}
                    onClick={() => setColor(badge.value)}
                  />
                ))}
              </div>
              <label style={{ marginTop: '10px' }}>{t('modal_folder_icon')}</label>
              <div className="icon-picker-row">
                {ICON_BADGES.map((badge) => (
                  <button
                    type="button"
                    key={badge.icon}
                    className={`icon-badge${icon === badge.icon ? ' selected' : ''}`}
                    title={t(badge.labelKey)}
                    aria-pressed={icon === badge.icon}
                    onClick={() => setIcon(badge.icon)}
                  >
                    {t(badge.labelKey)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p id="widemark-modal-error" className="modal-error-text" role="alert">{error}</p>}
        </div>
        <div className="modal-actions">
          {mode !== 'alert' && (
            <button className="modal-btn secondary" onClick={cancel}>
              {active.cancelLabel ?? t('common_cancel')}
            </button>
          )}
          <button className="modal-btn primary" onClick={onSubmit}>
            {active.submitLabel ?? t(mode === 'input' ? 'common_save' : 'common_ok')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

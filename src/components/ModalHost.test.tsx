import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModalHost } from './ModalHost.tsx';
import { useModalStore } from '../stores/modal.ts';

beforeEach(() => {
  useModalStore.setState({ active: null });
});

afterEach(() => {
  cleanup();
});

describe('ModalHost', () => {
  it('confirm dialog resolves true on confirm, false on cancel', async () => {
    render(<ModalHost />);

    const confirmed = useModalStore.getState().showConfirmDialog({ title: 'Delete?', message: 'Sure?' });
    fireEvent.click(await screen.findByText('Confirm'));
    expect(await confirmed).toBe(true);

    const declined = useModalStore.getState().showConfirmDialog({ title: 'Delete?', message: 'Sure?' });
    fireEvent.click(await screen.findByText('Cancel'));
    expect(await declined).toBe(false);
  });

  it('input dialog returns trimmed values and prepends https to a bare URL', async () => {
    render(<ModalHost />);
    const result = useModalStore.getState().openCustomModal({
      title: 'Add Bookmark',
      mode: 'input',
      showFields: ['title', 'url'],
    });

    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: '  Docs  ' } });
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'example.com' } });
    fireEvent.click(screen.getByText('Save'));

    expect(await result).toEqual({ title: 'Docs', url: 'https://example.com' });
  });

  it('folder-style dialog returns the picked color and icon', async () => {
    render(<ModalHost />);
    const result = useModalStore.getState().openCustomModal({
      title: 'Folder Style',
      mode: 'input',
      showFields: ['folderStyle'],
      fieldsVal: { color: '', icon: 'default' },
    });

    fireEvent.click((await screen.findByTitle('Blue')));
    fireEvent.click(screen.getByTitle('Star'));
    fireEvent.click(screen.getByText('Save'));

    expect(await result).toEqual({ color: '#3b82f6', icon: 'star' });
  });

  it.each(['mailto:person@example.com', 'about:blank', 'javascript:alert(1)', 'custom.scheme:123'])(
    'preserves the existing protocol when renaming %s', async (url) => {
      render(<ModalHost />);
      const result = useModalStore.getState().openCustomModal({
        title: 'Edit Bookmark', mode: 'input', showFields: ['title', 'url'],
        fieldsVal: { title: 'Original', url },
      });
      fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Renamed' } });
      fireEvent.click(screen.getByText('Save'));
      expect(await result).toEqual({ title: 'Renamed', url });
    }
  );

  it.each([
    ['localhost:3000', 'https://localhost:3000'],
    ['example.com:8080/path', 'https://example.com:8080/path'],
    ['mailto:person@example.com', 'mailto:person@example.com'],
    ['tel:123456', 'tel:123456'],
  ])('normalizes a newly entered address %s', async (url, expected) => {
    render(<ModalHost />);
    const result = useModalStore.getState().openCustomModal({
      title: 'Add Bookmark', mode: 'input', showFields: ['title', 'url'],
      fieldsVal: { title: 'Link', url: 'https://' },
    });
    fireEvent.change(await screen.findByLabelText('URL'), { target: { value: url } });
    fireEvent.click(screen.getByText('Save'));
    expect(await result).toEqual({ title: 'Link', url: expected });
  });

  it('exposes dialog semantics and keyboard-accessible style choices', async () => {
    render(<ModalHost />);
    useModalStore.getState().openCustomModal({
      title: 'Folder Style',
      mode: 'input',
      showFields: ['folderStyle'],
    });

    const dialog = await screen.findByRole('dialog', { name: 'Folder Style' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const blue = screen.getByRole('button', { name: 'Blue' });
    expect(blue).toHaveAttribute('aria-pressed', 'false');
    blue.focus();
    await userEvent.keyboard('{Enter}');
    expect(blue).toHaveAttribute('aria-pressed', 'true');
  });
});

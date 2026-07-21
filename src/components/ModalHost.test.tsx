import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
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
});

import { useEffect, useRef } from 'react';
import { cx } from '../../utils/cx.js';

const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal: traps focus, closes on Escape or overlay click, and
 * returns focus to the element that opened it.
 * @param {{ open: boolean, onClose: () => void, title?: string, size?: 'sm'|'md'|'lg' } & Record<string, any>} props
 */
function Modal({ open, onClose, title, size = 'md', children, footer }) {
    const modalRef = useRef(null);
    const previousActiveElement = useRef(null);

    useEffect(() => {
        if (!open) return;

        previousActiveElement.current = document.activeElement;
        const node = modalRef.current;
        const focusable = node?.querySelectorAll(FOCUSABLE_SELECTOR);
        (focusable?.[0] || node)?.focus();

        function handleKeyDown(e) {
            if (e.key === 'Escape') {
                onClose();
                return;
            }
            if (e.key !== 'Tab' || !node) return;

            const items = Array.from(node.querySelectorAll(FOCUSABLE_SELECTOR));
            if (items.length === 0) return;
            const first = items[0];
            const last = items[items.length - 1];

            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            previousActiveElement.current?.focus?.();
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div
                ref={modalRef}
                className={cx('modal', `modal-${size}`)}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                tabIndex={-1}
            >
                {title && (
                    <div className="modal-header">
                        <h2 className="modal-title">{title}</h2>
                        <button type="button" className="modal-close" onClick={onClose} aria-label="Close dialog">
                            ✕
                        </button>
                    </div>
                )}
                <div className="modal-body">{children}</div>
                {footer}
            </div>
        </div>
    );
}

export default Modal;

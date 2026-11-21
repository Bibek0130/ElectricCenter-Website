import { useEffect, useRef } from 'react';
import { cx } from '../../utils/cx.js';

const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Where focus starts: the first control in the dialog's content (the first form field, or the first button of a
 * confirmation), not the close button in the header. A person can start typing straight away, and pressing Space or
 * Enter can't "click" close by accident.
 */
function firstFocusable(dialog) {
    return dialog.querySelector('.modal-body')?.querySelector(FOCUSABLE_SELECTOR) ?? dialog.querySelector(FOCUSABLE_SELECTOR) ?? dialog;
}

/**
 * Accessible modal: traps focus, closes on Escape or overlay click, and
 * returns focus to the element that opened it.
 * @param {{ open: boolean, onClose: () => void, title?: string, size?: 'sm'|'md'|'lg' } & Record<string, any>} props
 */
function Modal({ open, onClose, title, size = 'md', children, footer }) {
    const modalRef = useRef(null);
    const previousActiveElement = useRef(null);

    // Parents usually hand in a brand-new onClose on every render (BookingModal's handleClose does). If the effects below
    // depended on it they would re-run on every keystroke and pull focus out of the text box, so the latest one is kept
    // in a ref and the effects depend on `open` alone.
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    });

    useEffect(() => {
        if (!open) return undefined;

        previousActiveElement.current = document.activeElement;
        const node = modalRef.current;

        function handleKeyDown(e) {
            if (e.key === 'Escape') {
                onCloseRef.current();
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
    }, [open]);

    // Keep focus inside the dialog. It moves in when the dialog opens, and afterwards only if the focused element is
    // gone (for example the form was replaced by the "Booking sent!" message). It never takes focus away from something
    // that is inside the dialog, so typing is never interrupted. Declared after the effect above so that one has already
    // noted which element to return focus to.
    useEffect(() => {
        const node = modalRef.current;
        if (open && node && !node.contains(document.activeElement)) firstFocusable(node).focus();
    });

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

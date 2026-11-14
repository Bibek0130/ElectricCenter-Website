import { useCallback, useState } from 'react';

/** Tracks the open/closed state of a modal, drawer, or dropdown. */
export function useDisclosure(initialOpen = false) {
    const [isOpen, setIsOpen] = useState(initialOpen);

    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);
    const toggle = useCallback(() => setIsOpen((v) => !v), []);

    return { isOpen, open, close, toggle };
}

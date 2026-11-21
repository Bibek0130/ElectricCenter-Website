import { useEffect, useMemo, useReducer } from 'react';
import { CartContext } from './context.js';
import { discountedPrice } from '../../../utils/format.js';

const STORAGE_KEY = 'ec_cart';

function readInitialState() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
        return [];
    }
}

function cartReducer(state, action) {
    switch (action.type) {
        case 'ADD': {
            const existing = state.find((item) => item.id === action.product.id);
            if (existing) {
                return state.map((item) => (item.id === action.product.id ? { ...item, qty: item.qty + action.qty } : item));
            }
            return [...state, { ...action.product, qty: action.qty, unitPrice: discountedPrice(action.product) }];
        }
        case 'SET_QTY':
            return state.map((item) => (item.id === action.id ? { ...item, qty: action.qty } : item)).filter((item) => item.qty > 0);
        case 'REMOVE':
            return state.filter((item) => item.id !== action.id);
        case 'CLEAR':
            return [];
        default:
            return state;
    }
}

export function CartProvider({ children }) {
    const [items, dispatch] = useReducer(cartReducer, undefined, readInitialState);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }, [items]);

    const value = useMemo(() => {
        const subtotal = items.reduce((sum, item) => sum + (item.unitPrice ?? 0) * item.qty, 0);
        const count = items.reduce((sum, item) => sum + item.qty, 0);
        return {
            items,
            subtotal,
            /**
             * False when any item has no price (it was added while prices were hidden), so `subtotal` would be
             * wrong. Show cart prices and totals only when this is true AND the "Show price" setting is on.
             */
            priced: items.every((item) => typeof item.unitPrice === 'number'),
            count,
            addItem: (product, qty = 1) => dispatch({ type: 'ADD', product, qty }),
            setItemQty: (id, qty) => dispatch({ type: 'SET_QTY', id, qty }),
            removeItem: (id) => dispatch({ type: 'REMOVE', id }),
            clear: () => dispatch({ type: 'CLEAR' }),
        };
    }, [items]);

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

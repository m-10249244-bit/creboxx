import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number) {
  const symbol = (window as any).currencySymbol || 'RM';
  const spacer = symbol.trim().match(/^[A-Za-z]+$/) ? ' ' : '';
  const val = Number(price || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${symbol}${spacer}${val}`;
}

const defaultRarityMap: Record<string, string> = {
  Common: 'bg-neutral-100 text-neutral-650',
  Rare: 'bg-blue-50 text-blue-600 border border-blue-100',
  Epic: 'bg-pink-50 text-pink-600 border border-pink-100',
  Secret: 'bg-amber-50 text-amber-700 font-bold border border-amber-100 shadow-sm shadow-amber-200/50',
  Hidden: 'bg-purple-50 text-purple-600 font-bold border border-purple-100',
  Limited: 'bg-emerald-50 text-emerald-600 font-bold border border-emerald-100'
};

export const RARITY_COLORS = new Proxy(defaultRarityMap, {
  get(target, prop: string) {
    if (typeof prop !== 'string') return undefined;
    const store = localStorage.getItem('local_col_rarity_tiers');
    if (store) {
      try {
        const tiers = JSON.parse(store);
        if (tiers[prop]?.style) {
          return tiers[prop].style;
        }
      } catch (e) {}
    }
    return target[prop] || 'bg-neutral-100 text-neutral-600';
  },
  ownKeys() {
    const store = localStorage.getItem('local_col_rarity_tiers');
    if (store) {
      try {
        const tiers = JSON.parse(store);
        return Object.keys(tiers);
      } catch (e) {}
    }
    return ['Common', 'Rare', 'Epic', 'Secret', 'Hidden', 'Limited'];
  },
  getOwnPropertyDescriptor(target, prop) {
    return {
      enumerable: true,
      configurable: true,
      writable: true,
      value: (this as any).get(target, prop)
    };
  }
}) as any;

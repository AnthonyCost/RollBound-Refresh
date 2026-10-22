export const signed = (n) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);

export const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

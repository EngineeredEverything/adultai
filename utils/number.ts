export function getNutsString(nuts: number | string): number {
    if (typeof nuts === 'number') {
        return nuts;
    }

    // Trim input string to avoid accidental whitespace issues
    const trimmed = nuts.trim();

    // Handle empty or undefined-like string
    if (trimmed === '') return 0;

    // Handle positive/negative infinity
    if (
        trimmed === 'POSITIVE_INFINITY' ||
        trimmed === 'Infinity' ||
        trimmed === '+Infinity'
    ) {
        return Number.POSITIVE_INFINITY;
    }

    if (
        trimmed === 'NEGATIVE_INFINITY' ||
        trimmed === '-Infinity'
    ) {
        return Number.NEGATIVE_INFINITY;
    }

    // Handle NaN string explicitly
    if (trimmed.toLowerCase() === 'nan') {
        return NaN;
    }

    // Attempt to parse as number
    const parsed = Number(trimmed);
    return isNaN(parsed) ? 0 : parsed; // fallback to 0 if parsing fails
}

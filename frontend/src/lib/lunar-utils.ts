/**
 * Lunar ↔ Solar date conversion utilities
 * Uses lunar-typescript library for accurate Vietnamese/Chinese calendar conversion
 */
import { Lunar, Solar } from 'lunar-typescript';

/**
 * Convert lunar date (DD/MM) + year → solar date (DD/MM)
 * VD: lunarToSolar('8/4', 2022) → '8/5'
 */
export function lunarToSolar(lunarDDMM: string, year: number): string | null {
    try {
        const parts = lunarDDMM.split('/');
        if (parts.length < 2) return null;
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        if (isNaN(day) || isNaN(month) || day < 1 || day > 30 || month < 1 || month > 12) return null;

        const lunar = Lunar.fromYmd(year, month, day);
        const solar = lunar.getSolar();
        return `${solar.getDay()}/${solar.getMonth()}`;
    } catch {
        return null;
    }
}

/**
 * Convert solar date (DD/MM) + year → lunar date (DD/MM)
 * VD: solarToLunar('8/5', 2022) → '8/4'
 */
export function solarToLunar(solarDDMM: string, year: number): string | null {
    try {
        const parts = solarDDMM.split('/');
        if (parts.length < 2) return null;
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        if (isNaN(day) || isNaN(month) || day < 1 || day > 31 || month < 1 || month > 12) return null;

        const solar = Solar.fromYmd(year, month, day);
        const lunar = solar.getLunar();
        return `${lunar.getDay()}/${lunar.getMonth()}`;
    } catch {
        return null;
    }
}

/**
 * Parse DD/MM string and validate
 */
export function isValidDDMM(str: string): boolean {
    if (!str) return false;
    const parts = str.split('/');
    if (parts.length !== 2) return false;
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    return !isNaN(day) && !isNaN(month) && day >= 1 && day <= 31 && month >= 1 && month <= 12;
}

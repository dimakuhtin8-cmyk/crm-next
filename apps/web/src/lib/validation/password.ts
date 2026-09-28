import { z } from 'zod';

/**
 * Единая политика пароля: минимум 8 символов при создании/смене.
 * Действует только на создание и смену пароля — вход существующих
 * аккаунтов (в т.ч. со старыми 6-символьными паролями) не блокируется.
 */
export const MIN_PASSWORD_LENGTH = 8;

export const PASSWORD_HINT = `Мінімум ${MIN_PASSWORD_LENGTH} символів`;

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Пароль має містити мінімум ${MIN_PASSWORD_LENGTH} символів`);

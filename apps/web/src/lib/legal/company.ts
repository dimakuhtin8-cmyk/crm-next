/**
 * Юридичні реквізити власника сервісу — єдине джерело правди для футера
 * та правових документів (вимога закону України «Про електронну комерцію»).
 */
export const SITE_OWNER = {
  legalForm: 'Фізична особа',
  name: 'Кухтін Дмитро Олександрович',
  email: 'helpnebulacrm@gmail.com',
} as const;

/** Рядок реквізитів: «Фізична особа Кухтін Дмитро Олександрович». */
export const siteOwnerLine = `${SITE_OWNER.legalForm} ${SITE_OWNER.name}`;

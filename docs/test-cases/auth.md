# Test Cases: Авторизация (Auth)

## 1. Регистрация через Email/Password

### TC-REG-001: Успешная регистрация

- **Status:** ✅ PASS
- **Response:** `{"success":true,"user":{"id":"cmsv97z240000a8nq65usv83f","email":"test2@example.com","name":"Test User"}}`

### TC-REG-002: Регистрация с существующим email

- **Status:** ✅ PASS
- **Response:** `{"error":"Цей email вже зареєстрований"}`

### TC-REG-003: Регистрация с коротким паролем

- **Status:** ✅ PASS
- **Response:** `{"error":"Неверные данные"}`

### TC-REG-004: Регистрация с невалидным email

- **Status:** ✅ PASS
- **Response:** `{"error":"Неверные данные"}`

---

## 2. Вход через Credentials (API)

### TC-LOGIN-001: Успешный вход

- **Status:** ✅ PASS
- **Response:** `{"success":true}`

### TC-LOGIN-002: Неверный пароль

- **Status:** ✅ PASS
- **Response:** `{"error":"Невірний email або пароль"}`

### TC-LOGIN-003: Несуществующий email

- **Status:** ✅ PASS
- **Response:** `{"error":"Невірний email або пароль"}`

### TC-LOGIN-004: Пустые поля

- **Status:** ✅ PASS
- **Response:** `{"error":"Неверные данные"}`

---

## 3. Magic Link

### TC-MAGIC-001: Отправка magic link

- **Status:** ⏳ NOT TESTED (requires email provider)

### TC-MAGIC-002: Верификация по ссылке

- **Status:** ⏳ NOT TESTED

### TC-MAGIC-003: Просроченная ссылка

- **Status:** ⏳ NOT TESTED

---

## 4. Google OAuth

### TC-GOOGLE-001: Успешный вход через Google

- **Status:** ✅ PASS (в browser)
- **Endpoint:** `/api/auth/providers` отвечает google provider

### TC-GOOGLE-002: Отмена авторизации

- **Status:** ⏳ NOT TESTED

---

## 5. Выход из аккаунта

### TC-LOGOUT-001: Успешный выход

- **Status:** ⏳ NOT TESTED (manual test)

### TC-LOGOUT-002: Доступ после выхода

- **Status:** ⏳ NOT TESTED

---

## 6. Защита маршрутов

### TC-PROTECT-001: Неавторизованный доступ к dashboard

- **Status:** ✅ PASS
- **Response:** 307 → `/uk/auth/login?callbackUrl=%2Fdashboard`

### TC-PROTECT-002: Неавторизованный доступ к settings

- **Status:** ✅ PASS
- **Response:** 307 → `/uk/auth/login?callbackUrl=%2Fsettings`

### TC-PROTECT-003: Страница логина доступна

- **Status:** ✅ PASS
- **Response:** 200, HTML с формой входа (email, password, Google, magic link)

---

## 7. Сессия

### TC-SESSION-001: Сохранение сессии при обновлении

- **Status:** ⏳ NOT TESTED

### TC-SESSION-002: Истечение сессии

- **Status:** ⏳ NOT TESTED

---

## Summary

| Category           | Tested | Passed | Failed |
| ------------------ | ------ | ------ | ------ |
| Регистрация        | 4      | 4      | 0      |
| Вход (Credentials) | 4      | 4      | 0      |
| Magic Link         | 0      | 0      | 0      |
| Google OAuth       | 1      | 1      | 0      |
| Защита маршрутов   | 3      | 3      | 0      |
| **Итого**          | **12** | **12** | **0**  |

## Bugs Found

- None

## Notes

- API routes moved from `[locale]/api/` to `app/api/` to fix i18n middleware interference
- DATABASE_URL changed to absolute path for SQLite compatibility
- Removed duplicate `@prisma/client` from web app (was causing wrong client version)

const GRAPH_API = 'https://graph.facebook.com/v18.0';

export interface WhatsAppMessage {
  messaging_product: string;
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'location' | 'contacts' | 'interactive';
  text?: { body: string };
  image?: { id: string; mime_type: string; caption?: string };
  document?: { id: string; mime_type: string; filename?: string; caption?: string };
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
}

export interface WhatsAppStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
}

export interface WhatsAppWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      contacts?: Array<{
        profile: { name: string };
        wa_id: string;
      }>;
      messages?: WhatsAppMessage[];
      statuses?: WhatsAppStatus[];
    };
    field: string;
  }>;
}

export interface WhatsAppWebhookBody {
  object: string;
  entry: WhatsAppWebhookEntry[];
}

// Send text message
export async function sendTextMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string,
) {
  const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: text },
    }),
  });

  return res.json();
}

// Send template message (for notifications)
export async function sendTemplateMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  templateName: string,
  languageCode: string = 'uk',
  components?: Array<{
    type: string;
    parameters: Array<{ type: string; text?: string }>;
  }>,
) {
  const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components && { components }),
      },
    }),
  });

  return res.json();
}

// Send document
export async function sendDocument(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  documentId: string,
  caption?: string,
  filename?: string,
) {
  const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'document',
      document: {
        id: documentId,
        ...(caption && { caption }),
        ...(filename && { filename }),
      },
    }),
  });

  return res.json();
}

// Send image
export async function sendImage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  imageId: string,
  caption?: string,
) {
  const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'image',
      image: {
        id: imageId,
        ...(caption && { caption }),
      },
    }),
  });

  return res.json();
}

// Upload media (for sending documents/images)
export async function uploadMedia(
  phoneNumberId: string,
  accessToken: string,
  file: ArrayBuffer,
  mimeType: string,
  filePurpose: 'whatsapp' | 'advertising' = 'whatsapp',
) {
  const formData = new FormData();
  formData.append('messaging_product', filePurpose);
  formData.append('file', new Blob([file], { type: mimeType }), 'file');

  const res = await fetch(`${GRAPH_API}/${phoneNumberId}/media`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
    body: formData,
  });

  return res.json();
}

// Mark message as read
export async function markAsRead(
  phoneNumberId: string,
  accessToken: string,
  messageId: string,
) {
  const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    }),
  });

  return res.json();
}

// Register phone number
export async function registerPhoneNumber(
  wabaId: string,
  accessToken: string,
  phoneNumberId: string,
) {
  const res = await fetch(`${GRAPH_API}/${wabaId}/phone_numbers`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ display_phone_number: phoneNumberId }),
  });

  return res.json();
}

// Verify webhook
export function verifyWebhook(mode: string, token: string, challenge: string, verifyToken: string) {
  if (mode === 'subscribe' && token === verifyToken) {
    return challenge;
  }
  return null;
}

// Notification text builders
export function taskNotificationText(task: { title: string; type: string; priority: string; dueDate: string | null }, event: 'created' | 'assigned' | 'due_soon' | 'overdue' | 'status_changed') {
  const typeIcons: Record<string, string> = { task: '📋', call: '📞', email: '✉️', meeting: '🤝', follow_up: '🔄' };
  const priorityLabels: Record<string, string> = { urgent: '🔴 Терміново', high: '🟠 Високий', medium: '🟡 Середній', low: '🟢 Низький' };
  const icon = typeIcons[task.type] || '📋';
  const priority = priorityLabels[task.priority] || task.priority;

  let header: string;
  switch (event) {
    case 'created': header = `${icon} Нова задача створена`; break;
    case 'assigned': header = `${icon} Вам призначено задачу`; break;
    case 'due_soon': header = `${icon} Задача наближається до дедлайну`; break;
    case 'overdue': header = `${icon} ⚠️ Задача протермінована!`; break;
    case 'status_changed': header = `${icon} Статус задачі змінено`; break;
    default: header = `${icon} Оновлення задачі`;
  }

  let text = `${header}\n\n${task.title}\nПриоритет: ${priority}`;
  if (task.dueDate) {
    text += `\nДедлайн: ${new Date(task.dueDate).toLocaleString('uk')}`;
  }
  return text;
}

export function dealNotificationText(deal: { title: string; value: number; currency: string }, event: 'created' | 'stage_changed' | 'won' | 'lost') {
  let header: string;
  switch (event) {
    case 'created': header = '💼 Нова угода створена'; break;
    case 'stage_changed': header = '🔄 Етап угоди змінено'; break;
    case 'won': header = '🎉 Угода виграна!'; break;
    case 'lost': header = '❌ Угода втрачена'; break;
    default: header = '💼 Оновлення угоди';
  }

  return `${header}\n\n${deal.title}\nСума: ${deal.value.toLocaleString('uk')} ${deal.currency}`;
}

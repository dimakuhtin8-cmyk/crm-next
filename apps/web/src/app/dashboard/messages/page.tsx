'use client';

import { Card, CardContent, Badge, Avatar } from '@/components/ui';

const mockConversations = [
  {
    id: '1',
    channel: 'telegram',
    contact: 'Іван Петренко',
    lastMessage: 'Дякую за КП, розгляну',
    time: '10:30',
    unread: 2,
  },
  {
    id: '2',
    channel: 'whatsapp',
    contact: 'Марія Коваленко',
    lastMessage: 'Коли можна зустрітися?',
    time: '09:15',
    unread: 0,
  },
  {
    id: '3',
    channel: 'email',
    contact: 'Олександр Шевченко',
    lastMessage: 'Відправив договір на підпис',
    time: 'Вчора',
    unread: 1,
  },
];

const channelConfig = {
  telegram: { label: 'Telegram', color: 'bg-blue-500' },
  whatsapp: { label: 'WhatsApp', color: 'bg-green-500' },
  email: { label: 'Email', color: 'bg-slate-500' },
  instagram: { label: 'Instagram', color: 'bg-pink-500' },
};

export default function MessagesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Повідомлення</h1>
          <p className="text-muted-foreground">Спілкування з клієнтами</p>
        </div>
      </div>

      <div className="grid gap-3">
        {mockConversations.map((conv) => (
          <Card key={conv.id} className="cursor-pointer hover:border-primary/50 transition-colors">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <Avatar name={conv.contact} />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{conv.contact}</p>
                    <div
                      className={`h-2 w-2 rounded-full ${channelConfig[conv.channel as keyof typeof channelConfig].color}`}
                    />
                    <span className="text-xs text-muted-foreground">
                      {channelConfig[conv.channel as keyof typeof channelConfig].label}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate max-w-md">
                    {conv.lastMessage}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{conv.time}</span>
                {conv.unread > 0 && <Badge>{conv.unread}</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

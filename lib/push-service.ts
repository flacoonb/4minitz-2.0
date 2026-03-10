import PushSubscription from '@/models/PushSubscription';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  lang?: 'de' | 'en';
}

type WebPushClient = typeof import('web-push');

let cachedWebPushClient: WebPushClient | null = null;
let vapidConfigured = false;

function getVapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:noreply@nxtminutes.local';

  if (!publicKey || !privateKey) {
    return null;
  }

  return { publicKey, privateKey, subject };
}

async function getWebPushClient(): Promise<WebPushClient | null> {
  const vapid = getVapidConfig();
  if (!vapid) {
    return null;
  }

  if (!cachedWebPushClient) {
    const webPushModule = await import('web-push');
    cachedWebPushClient = (webPushModule.default || webPushModule) as WebPushClient;
  }

  if (!vapidConfigured) {
    cachedWebPushClient.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
    vapidConfigured = true;
  }

  return cachedWebPushClient;
}

function sanitizePayload(payload: PushPayload) {
  return {
    title: payload.title,
    body: payload.body,
    url: payload.url || '/dashboard',
    tag: payload.tag || 'nxtminutes-notification',
    icon: payload.icon || '/android-chrome-192x192.png',
    badge: payload.badge || '/favicon-32x32.png',
    lang: payload.lang || 'de',
  };
}

export async function sendPushToUserIds(userIds: string[], payload: PushPayload): Promise<void> {
  const uniqueUserIds = Array.from(new Set(userIds.map(id => String(id).trim()).filter(Boolean)));
  if (uniqueUserIds.length === 0) {
    return;
  }

  const webPushClient = await getWebPushClient();
  if (!webPushClient) {
    return;
  }

  const subscriptions = await PushSubscription.find(
    { userId: { $in: uniqueUserIds } },
    { endpoint: 1, keys: 1 }
  ).lean();

  if (!subscriptions.length) {
    return;
  }

  const serializedPayload = JSON.stringify(sanitizePayload(payload));

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webPushClient.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.keys.p256dh,
              auth: subscription.keys.auth,
            },
          },
          serializedPayload,
          { TTL: 60 }
        );
      } catch (error: any) {
        const statusCode = Number(error?.statusCode || 0);
        if (statusCode === 404 || statusCode === 410) {
          await PushSubscription.deleteOne({ endpoint: subscription.endpoint });
          return;
        }
        console.error('Failed to send push notification:', error);
      }
    })
  );
}

export function getPushPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
}

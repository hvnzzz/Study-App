export async function setupNotificationsOnLaunch(): Promise<void> {
  return;
}

export async function scheduleLocalNotification(args: {
  title: string;
  body: string;
}): Promise<void> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return;
  }

  if (Notification.permission === 'granted') {
    new Notification(args.title, { body: args.body });
    return;
  }

  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      new Notification(args.title, { body: args.body });
    }
  }
}

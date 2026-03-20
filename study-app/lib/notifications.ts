import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function setupNotificationsOnLaunch(): Promise<void> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    await Notifications.requestPermissionsAsync();
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('pomodoro-default', {
      name: 'Pomodoro Sessions',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export async function scheduleLocalNotification(args: {
  title: string;
  body: string;
}): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: args.title,
      body: args.body,
      ...(Platform.OS === 'android' ? { channelId: 'pomodoro-default' } : {}),
    },
    trigger: null,
  });
}

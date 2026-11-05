import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking } from 'react-native';

import GtrackAlarm from '../../../modules/gtrack-alarm';

// Phone makers stop background apps on top of Android's own battery saving, each with its own
// switches in its own menus. These are the steps per maker, each with the settings page to open
// (where an app may open it; several addresses, since they move between OS versions) and, where
// the phone lets an app read the setting, a check so the step ticks itself.
// dontkillmyapp.com keeps current steps per brand.

const PACKAGE = Constants.expoConfig?.android?.package ?? 'com.sahebbeshra.gtrack';

/** A settings page to open: by action, or by exact screen (package + class). */
type Page = { action?: string; packageName?: string; className?: string; extra?: Record<string, string> };

export type PhoneStep = {
  id: string;
  title: string;
  /** What to do once the page is open. */
  body: string;
  /** Pages to try in order. Empty: open G Track's app settings. Null: nothing to open. */
  open: Page[] | null;
  /** Reads the setting: true when done, false when not, null when this phone won't say. */
  check?: () => boolean | null;
};

export type PhoneSteps = { brand: string; steps: PhoneStep[]; guideUrl: string };

const lockInRecents = (how: string): PhoneStep => ({
  id: 'lock-recents',
  title: 'Lock G Track in Recent apps',
  body: `${how} Then clearing Recent apps won't close it.`,
  open: null,
});

const BRANDS: { match: RegExp; steps: PhoneSteps }[] = [
  {
    match: /vivo|iqoo/,
    steps: {
      brand: 'Vivo',
      guideUrl: 'https://dontkillmyapp.com/vivo',
      steps: [
        {
          id: 'vivo-sleep',
          title: 'Turn off Sleep standby optimization',
          body: 'Vivo freezes apps while it thinks you are asleep, which stops sharing overnight. Turn the top switch off.',
          open: [
            {
              packageName: 'com.iqoo.powersaving',
              className: 'com.iqoo.powersaving.activity.BatterySleepModeActivity',
            },
          ],
          check: () => {
            const value = GtrackAlarm.readSystemSetting('power_sleep_mode_enabled');
            return value === null ? null : value === '0';
          },
        },
        {
          id: 'vivo-background',
          title: 'Background power control: allow',
          body: 'Find G Track in the list and choose "Allow background power usage".',
          open: [
            { packageName: 'com.iqoo.powersaving', className: 'com.iqoo.powersaving.BackgroundHighUsageActivity' },
          ],
        },
        {
          id: 'vivo-autostart',
          title: 'Turn on Autostart',
          body: "Vivo doesn't let apps open this page. Go to Settings → Apps → Autostart and turn on G Track.",
          open: [],
        },
        lockInRecents('Open Recent apps and pull down on G Track.'),
      ],
    },
  },
  {
    match: /xiaomi|redmi|poco/,
    steps: {
      brand: 'Xiaomi',
      guideUrl: 'https://dontkillmyapp.com/xiaomi',
      steps: [
        {
          id: 'xiaomi-autostart',
          title: 'Turn on Autostart',
          body: 'Find G Track and turn it on.',
          open: [
            {
              packageName: 'com.miui.securitycenter',
              className: 'com.miui.permcenter.autostart.AutoStartManagementActivity',
            },
          ],
        },
        {
          id: 'xiaomi-battery',
          title: 'Battery saver: No restrictions',
          body: 'Choose "No restrictions" for G Track.',
          open: [
            // Exact screens first: on some phones an unanswered action opens an empty app chooser
            // instead of failing, and the next address would never be tried.
            {
              packageName: 'com.miui.powerkeeper',
              className: 'com.miui.powerkeeper.ui.HiddenAppsConfigActivity',
              extra: { package_name: PACKAGE, package_label: 'G Track' },
            },
            {
              action: 'miui.intent.action.HIDDEN_APPS_CONFIG_ACTIVITY',
              extra: { package_name: PACKAGE, package_label: 'G Track' },
            },
          ],
        },
        lockInRecents('Open Recent apps, long-press G Track and tap the lock.'),
      ],
    },
  },
  {
    match: /oppo|realme|oneplus/,
    steps: {
      brand: 'Oppo / Realme / OnePlus',
      guideUrl: 'https://dontkillmyapp.com/oppo',
      steps: [
        {
          id: 'oppo-autolaunch',
          title: 'Allow auto launch',
          body: 'Find G Track and turn on auto launch.',
          open: [
            {
              packageName: 'com.coloros.safecenter',
              className: 'com.coloros.safecenter.startupapp.StartupAppListActivity',
            },
            {
              packageName: 'com.coloros.safecenter',
              className: 'com.coloros.safecenter.permission.startup.StartupAppListActivity',
            },
            { packageName: 'com.oppo.safe', className: 'com.oppo.safe.permission.startup.StartupAppListActivity' },
            {
              packageName: 'com.oneplus.security',
              className: 'com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity',
            },
          ],
        },
        {
          id: 'oppo-background',
          title: 'Allow background activity',
          body: 'In G Track\'s app info, open Battery and turn on "Allow background activity".',
          open: [],
        },
        lockInRecents('Open Recent apps, tap the menu on G Track and choose Lock.'),
      ],
    },
  },
  {
    match: /samsung/,
    steps: {
      brand: 'Samsung',
      guideUrl: 'https://dontkillmyapp.com/samsung',
      steps: [
        {
          id: 'samsung-never-sleeping',
          title: 'Add G Track to Never sleeping apps',
          body: "Open Background usage limits → Never sleeping apps and add G Track. Make sure it isn't under Sleeping or Deep sleeping apps.",
          open: [
            { packageName: 'com.samsung.android.lool', className: 'com.samsung.android.sm.battery.ui.BatteryActivity' },
            { packageName: 'com.samsung.android.lool', className: 'com.samsung.android.sm.ui.battery.BatteryActivity' },
          ],
        },
      ],
    },
  },
  {
    match: /huawei|honor/,
    steps: {
      brand: 'Huawei / Honor',
      guideUrl: 'https://dontkillmyapp.com/huawei',
      steps: [
        {
          id: 'huawei-launch',
          title: 'App launch: manage manually',
          body: 'Find G Track, switch it to "Manage manually" and turn on all three options.',
          open: [
            {
              packageName: 'com.huawei.systemmanager',
              className: 'com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity',
            },
            {
              packageName: 'com.huawei.systemmanager',
              className: 'com.huawei.systemmanager.optimize.process.ProtectActivity',
            },
          ],
        },
      ],
    },
  },
];

const OTHER: PhoneSteps = {
  brand: 'Your phone',
  guideUrl: 'https://dontkillmyapp.com',
  steps: [
    {
      id: 'other-battery',
      title: 'Battery: Unrestricted',
      body: "In G Track's app info, open Battery and choose Unrestricted.",
      open: [],
    },
  ],
};

export function phoneSteps(): PhoneSteps {
  const maker = `${Device.manufacturer ?? ''} ${Device.brand ?? ''}`.toLowerCase();
  return BRANDS.find((b) => b.match.test(maker))?.steps ?? OTHER;
}

/** Opens a step's page: the first address this phone has, else G Track's app settings. */
export async function openStepPage(pages: Page[]) {
  for (const page of pages) {
    // An empty entry stands for G Track's own app settings.
    if (!page.action && !page.className) break;
    try {
      await IntentLauncher.startActivityAsync(page.action ?? 'android.intent.action.MAIN', {
        packageName: page.packageName,
        className: page.className,
        extra: page.extra,
      });
      return;
    } catch {
      // Not on this phone (or apps may not open it): try the next address.
    }
  }
  await Linking.openSettings();
}

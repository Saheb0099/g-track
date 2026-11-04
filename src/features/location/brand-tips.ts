import * as Device from 'expo-device';

// Some phone makers stop background apps on top of Android's own battery saving.
// These are the usual switches; exact names vary by OS version, so each tip also links
// to dontkillmyapp.com, which keeps current steps per brand.

export type BrandTip = { brand: string; steps: string[]; guideUrl: string };

const TIPS: { match: RegExp; tip: BrandTip }[] = [
  {
    match: /vivo|iqoo/,
    tip: {
      brand: 'Vivo',
      steps: [
        'Settings → Battery → Background power consumption management → G Track → Allow',
        'Settings → Apps → Autostart → turn on G Track',
        'In Recent apps, pull down on G Track to lock it so it is not cleared',
      ],
      guideUrl: 'https://dontkillmyapp.com/vivo',
    },
  },
  {
    match: /xiaomi|redmi|poco/,
    tip: {
      brand: 'Xiaomi',
      steps: [
        'Settings → Apps → G Track → Battery saver → No restrictions',
        'Settings → Apps → G Track → Autostart → on',
        'In Recent apps, long-press G Track and tap the lock',
      ],
      guideUrl: 'https://dontkillmyapp.com/xiaomi',
    },
  },
  {
    match: /oppo|realme|oneplus/,
    tip: {
      brand: 'Oppo / Realme / OnePlus',
      steps: [
        'Settings → Battery → App battery management → G Track → Allow background activity',
        'Same screen → Allow auto launch',
        'In Recent apps, lock G Track',
      ],
      guideUrl: 'https://dontkillmyapp.com/oppo',
    },
  },
  {
    match: /samsung/,
    tip: {
      brand: 'Samsung',
      steps: [
        'Settings → Battery → Background usage limits → Never sleeping apps → add G Track',
        'Make sure G Track is not under Sleeping or Deep sleeping apps',
      ],
      guideUrl: 'https://dontkillmyapp.com/samsung',
    },
  },
];

const GENERIC: BrandTip = {
  brand: 'Your phone',
  steps: ['Settings → Apps → G Track → Battery → Unrestricted', "Don't swipe G Track away in Recent apps"],
  guideUrl: 'https://dontkillmyapp.com',
};

export function brandTip(): BrandTip {
  const maker = `${Device.manufacturer ?? ''} ${Device.brand ?? ''}`.toLowerCase();
  return TIPS.find((t) => t.match.test(maker))?.tip ?? GENERIC;
}

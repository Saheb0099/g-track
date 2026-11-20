import { Fragment } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, RowDivider, SectionLabel } from '@/components/card';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { APP_VERSION } from '@/lib/app-version';
import { openLink, OSM_COPYRIGHT_URL, PRIVACY_URL, SOURCE_URL } from '@/lib/links';
import { type as typeStyles, useColors } from '@/lib/theme';

type Credit = { title: string; detail: string; url?: string };

/** Where the maps come from. OpenStreetMap's credit also stays on the map itself (MapCredit). */
const MAPS: Credit[] = [
  { title: 'Map data', detail: '© OpenStreetMap contributors, ODbL', url: OSM_COPYRIGHT_URL },
  { title: 'OpenFreeMap', detail: 'Standard, Bright and Simple maps', url: 'https://openfreemap.org' },
  { title: 'OpenMapTiles', detail: 'Map design behind the OpenFreeMap maps', url: 'https://openmaptiles.org' },
  { title: 'CARTO', detail: 'Voyager map', url: 'https://carto.com/attributions' },
  { title: 'VersaTiles', detail: 'Colorful map', url: 'https://versatiles.org' },
  {
    title: 'ESA WorldCover',
    detail: 'Land cover in the Colorful map, CC BY 4.0',
    url: 'https://esa-worldcover.org',
  },
  { title: 'OpenStreetMap', detail: 'OpenStreetMap map', url: 'https://www.openstreetmap.org' },
  { title: 'OpenStreetMap France', detail: 'CyclOSM and Humanitarian maps', url: 'https://www.openstreetmap.fr' },
  { title: 'OpenTopoMap', detail: 'Topo map, CC-BY-SA', url: 'https://opentopomap.org' },
];

/** What the app is made with. */
const BUILT_WITH: Credit[] = [
  { title: 'MapLibre', detail: 'Draws the maps', url: 'https://maplibre.org' },
  { title: 'Expo and React Native', detail: 'The app itself', url: 'https://expo.dev' },
  { title: 'Supabase', detail: 'Accounts and storing locations', url: 'https://supabase.com' },
  {
    title: 'Roboto and Material Symbols',
    detail: 'Text and icons by Google, Apache 2.0',
    url: 'https://fonts.google.com',
  },
];

const MORE: Credit[] = [
  { title: 'Privacy policy', detail: 'What G Track stores and why', url: PRIVACY_URL },
  { title: 'Source code', detail: 'Open source on GitHub, MIT licence', url: SOURCE_URL },
];

/** Version, credits for the maps and the tools G Track is built with, and its policies. */
export default function About() {
  const colors = useColors();
  const safe = useSafeAreaInsets();
  return (
    <ScrollView
      // Ends at Android's navigation bar, so nothing scrolls behind its buttons.
      style={{ backgroundColor: colors.background, marginBottom: safe.bottom }}
      contentContainerStyle={[styles.container, { paddingBottom: 32 }]}>
      <View style={styles.app}>
        <View style={[styles.logo, { backgroundColor: colors.accent }]}>
          <Icon name="location_on" size={32} filled color={colors.onAccent} />
        </View>
        <Text style={[typeStyles.heading, { color: colors.text }]}>G Track</Text>
        <Text style={[typeStyles.caption, { color: colors.muted }]}>Version {APP_VERSION}</Text>
      </View>

      <Section label="Maps" credits={MAPS} />
      <Section label="Built with" credits={BUILT_WITH} />
      <Section label="More" credits={MORE} />
    </ScrollView>
  );
}

function Section({ label, credits }: { label: string; credits: Credit[] }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <SectionLabel>{label}</SectionLabel>
      <Card>
        {credits.map((credit, i) => (
          <Fragment key={credit.title}>
            {i > 0 && <RowDivider inset={16} />}
            <Pressable
              onPress={() => credit.url && openLink(credit.url)}
              disabled={!credit.url}
              accessibilityRole={credit.url ? 'link' : undefined}
              android_ripple={credit.url ? { color: `${colors.text}14` } : undefined}
              style={styles.row}>
              <View style={styles.flex}>
                <Text style={[typeStyles.bodyStrong, { color: colors.text }]}>{credit.title}</Text>
                <Text style={[typeStyles.caption, { color: colors.muted }]}>{credit.detail}</Text>
              </View>
              {credit.url && <Icon name="open_in_new" size={20} color={colors.muted} />}
            </Pressable>
          </Fragment>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 20 },
  app: { alignItems: 'center', gap: 4, paddingVertical: 8 },
  logo: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  section: { gap: 8 },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  flex: { flex: 1 },
});

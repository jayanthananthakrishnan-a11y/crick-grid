import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Dimensions, StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, {
  Circle, Ellipse, Rect, Line, G, Path, Defs,
  LinearGradient, RadialGradient, Stop, Text as SvgText
} from 'react-native-svg';

const SW = Dimensions.get('window').width;

function CricketNetsSvgIcon({ size = 28 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {/* Outer Net Box Frame */}
      <Rect x="3" y="5" width="26" height="22" rx="3" fill="#1b5e20" stroke="#81c784" strokeWidth="1.2" />
      
      {/* Net Grid Pattern Lines */}
      <Path
        d="M 9 5 V 27 M 16 5 V 27 M 23 5 V 27 M 3 12 H 29 M 3 19 H 29"
        stroke="#4caf50"
        strokeWidth="0.8"
        strokeDasharray="2,2"
        opacity="0.75"
      />

      {/* Stumps in the Nets */}
      <Line x1="13" y1="24" x2="13" y2="13" stroke="#ffe082" strokeWidth="1.8" strokeLinecap="round" />
      <Line x1="16" y1="24" x2="16" y2="13" stroke="#ffe082" strokeWidth="1.8" strokeLinecap="round" />
      <Line x1="19" y1="24" x2="19" y2="13" stroke="#ffe082" strokeWidth="1.8" strokeLinecap="round" />
      <Line x1="12" y1="13" x2="20" y2="13" stroke="#ffb300" strokeWidth="1.2" strokeLinecap="round" />

      {/* Red Leather Cricket Ball */}
      <Circle cx="8" cy="22" r="3" fill="#d32f2f" stroke="#ffffff" strokeWidth="0.6" />
    </Svg>
  );
}

function WagonWheelSvgIcon({ size = 28 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {/* Ground Outer Oval */}
      <Circle cx="16" cy="16" r="14" fill="#2e7d32" stroke="#1b5e20" strokeWidth="1.2" />
      {/* Inner 30yd Circle */}
      <Circle cx="16" cy="16" r="8" fill="none" stroke="#81c784" strokeWidth="0.8" strokeDasharray="2,2" />
      {/* Pitch Strip */}
      <Rect x="14.5" y="11" width="3" height="10" fill="#d4b483" rx="0.5" />
      {/* Shot Direction Vectors */}
      <Line x1="16" y1="16" x2="16" y2="4" stroke="#ffb300" strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="16" y1="16" x2="26" y2="8" stroke="#64b5f6" strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="16" y1="16" x2="27" y2="20" stroke="#e53935" strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="16" y1="16" x2="7" y2="10" stroke="#81c784" strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="16" y1="16" x2="8" y2="24" stroke="#9c27b0" strokeWidth="1.5" strokeLinecap="round" />
      {/* Center dot */}
      <Circle cx="16" cy="16" r="1.8" fill="#ffffff" />
    </Svg>
  );
}

function StadiumHeroGraphic() {
  const w = SW - 32;
  const h = 175;
  return (
    <Svg width={w} height={h} viewBox="0 0 360 175">
      <Defs>
        <LinearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#082012" />
          <Stop offset="100%" stopColor="#1a4d2e" />
        </LinearGradient>
        <LinearGradient id="pitchGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#d8b880" />
          <Stop offset="100%" stopColor="#b5945b" />
        </LinearGradient>
        <LinearGradient id="grassGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#2e7d32" />
          <Stop offset="100%" stopColor="#1b5e20" />
        </LinearGradient>
        <LinearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#ffe082" />
          <Stop offset="100%" stopColor="#ffb300" />
        </LinearGradient>
        <RadialGradient id="lightGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
          <Stop offset="40%" stopColor="#81c784" stopOpacity="0.3" />
          <Stop offset="100%" stopColor="#082012" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* Sky Background */}
      <Rect x="0" y="0" width="360" height="175" fill="url(#skyGrad)" rx="16" />

      {/* Floodlight Glows */}
      <Circle cx="40" cy="25" r="35" fill="url(#lightGlow)" />
      <Circle cx="320" cy="25" r="35" fill="url(#lightGlow)" />

      {/* Floodlight Poles */}
      <Line x1="40" y1="25" x2="40" y2="90" stroke="#455a64" strokeWidth="2" />
      <Line x1="320" y1="25" x2="320" y2="90" stroke="#455a64" strokeWidth="2" />
      <Circle cx="40" cy="25" r="5" fill="#fff" />
      <Circle cx="320" cy="25" r="5" fill="#fff" />

      {/* Outfield Oval */}
      <Ellipse cx="180" cy="140" rx="165" ry="42" fill="url(#grassGrad)" stroke="#4caf50" strokeWidth="1.5" />
      <Ellipse cx="180" cy="140" rx="110" ry="26" fill="none" stroke="#a5d6a7" strokeWidth="0.8" strokeDasharray="5,4" opacity="0.6" />

      {/* Pitch Strip */}
      <Rect x="156" y="105" width="48" height="60" fill="url(#pitchGrad)" rx="3" stroke="#8d6e63" strokeWidth="1" />
      <Line x1="160" y1="120" x2="200" y2="120" stroke="#ffffff" strokeWidth="1.5" />
      <Line x1="160" y1="155" x2="200" y2="155" stroke="#ffffff" strokeWidth="1.5" />

      {/* Stumps & Bails (Batter End) */}
      <Line x1="172" y1="120" x2="172" y2="98" stroke="#ffe082" strokeWidth="2.5" strokeLinecap="round" />
      <Line x1="180" y1="120" x2="180" y2="98" stroke="#ffe082" strokeWidth="2.5" strokeLinecap="round" />
      <Line x1="188" y1="120" x2="188" y2="98" stroke="#ffe082" strokeWidth="2.5" strokeLinecap="round" />
      <Line x1="170" y1="98" x2="190" y2="98" stroke="#ffb300" strokeWidth="2" strokeLinecap="round" />

      {/* Ball Trajectory Line */}
      <Path d="M 60 70 Q 120 40 178 96" fill="none" stroke="#ff8a80" strokeWidth="1.8" strokeDasharray="4,3" opacity="0.9" />

      {/* Leather Cricket Ball */}
      <Circle cx="60" cy="70" r="12" fill="#d32f2f" stroke="#b71c1c" strokeWidth="1" />
      <Path d="M 52 64 C 58 70, 62 70, 68 76" fill="none" stroke="#ffffff" strokeWidth="1.2" strokeDasharray="2,1.5" />

      {/* Cricket Bat */}
      <G transform="translate(235, 45) rotate(22)">
        <Rect x="0" y="0" width="14" height="75" fill="url(#goldGrad)" rx="4" stroke="#d7ccc8" strokeWidth="0.8" />
        <Rect x="4" y="-22" width="6" height="24" fill="#37474f" rx="3" />
        <Line x1="4" y1="-10" x2="10" y2="-10" stroke="#ffffff" strokeWidth="1" opacity="0.6" />
      </G>

      {/* Subtle Title Badge overlay */}
      <Rect x="100" y="14" width="160" height="24" fill="#000000" fillOpacity="0.4" rx="12" />
      <SvgText x="180" y="30" fontSize="11" fill="#ffe082" fontWeight="bold" textAnchor="middle" letterSpacing="1">
        PRO ANALYTICS SUITE
      </SvgText>
    </Svg>
  );
}

function FeatureCard({ icon, title, desc, tag }) {
  return (
    <View style={styles.featureCard}>
      <View style={styles.featureEmojiBox}>
        {typeof icon === 'string' ? <Text style={styles.featureEmoji}>{icon}</Text> : icon}
      </View>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDesc}>{desc}</Text>
      {tag && <View style={styles.featureTag}><Text style={styles.featureTagText}>{tag}</Text></View>}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: '#092414' }}>
      <StatusBar barStyle="light-content" backgroundColor="#092414" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        
        {/* Header Branding */}
        <View style={styles.heroHeader}>
          <View style={styles.brandRow}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeIcon}>🏏</Text>
            </View>
            <View>
              <Text style={styles.brandName}>Crick Grid</Text>
              <Text style={styles.brandSubtitle}>Ball Tracking & Match Centre</Text>
            </View>
          </View>
          <View style={styles.proPill}>
            <Text style={styles.proPillText}>v2.0 PRO</Text>
          </View>
        </View>

        {/* Hero Graphic Canvas */}
        <View style={styles.graphicContainer}>
          <StadiumHeroGraphic />
        </View>

        {/* Quick Highlights Strip */}
        <View style={styles.highlightStrip}>
          <View style={styles.hItem}>
            <View style={styles.hIconBox}>
              <Text style={styles.hIconText}>🎯</Text>
            </View>
            <Text style={styles.hText}>Pitch Mapping</Text>
          </View>

          <View style={styles.hDot} />

          <View style={styles.hItem}>
            <View style={styles.hIconBox}>
              <WagonWheelSvgIcon size={16} />
            </View>
            <Text style={styles.hText}>Wagon Wheel</Text>
          </View>

          <View style={styles.hDot} />

          <View style={styles.hItem}>
            <View style={styles.hIconBox}>
              <Text style={styles.hIconText}>📄</Text>
            </View>
            <Text style={styles.hText}>PDF Exports</Text>
          </View>
        </View>

        {/* Action Cards Container */}
        <View style={styles.actionContainer}>
          <Text style={styles.sectionHeader}>SELECT SESSION TYPE</Text>

          {/* Net Practice Card */}
          <TouchableOpacity
            style={styles.actionCardNets}
            onPress={() => router.push('/(nets)')}
            activeOpacity={0.88}
          >
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconCircleGreen}>
                <CricketNetsSvgIcon size={28} />
              </View>
              <View style={styles.badgeNets}>
                <Text style={styles.badgeNetsText}>PRACTICE MODE</Text>
              </View>
            </View>

            <Text style={styles.cardTitleLight}>Net Practice Sessions</Text>
            <Text style={styles.cardSubLight}>
              Ball-by-ball logging, interactive Pitch Heatmaps, Wagon Wheel shot direction & session PDF reports.
            </Text>

            <View style={styles.cardFooterRow}>
              <Text style={styles.cardBtnTextGreen}>Launch Net Session →</Text>
            </View>
          </TouchableOpacity>

          {/* Match Center Card */}
          <TouchableOpacity
            style={styles.actionCardMatch}
            onPress={() => router.push('/match')}
            activeOpacity={0.88}
          >
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconCircleGold}>
                <Text style={{ fontSize: 26 }}>🏆</Text>
              </View>
              <View style={styles.badgeLive}>
                <View style={styles.livePulseDot} />
                <Text style={styles.badgeLiveText}>LIVE ENGINE</Text>
              </View>
            </View>

            <Text style={styles.cardTitleLight}>Match Centre</Text>
            <Text style={styles.cardSubLight}>
              Complete live scoring engine, full scorecards, Over-by-Over Manhattan bar charts, Innings Worm graphs & Match PDF generation.
            </Text>

            <View style={styles.cardFooterRow}>
              <Text style={styles.cardBtnTextGold}>Open Match Centre →</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Features Carousel Strip */}
        <View style={styles.featuresSection}>
          <Text style={styles.featuresSectionTitle}>ANALYTICAL FEATURES</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuresScroll}
          >
            <FeatureCard icon="📍" title="Pitch Map" desc="Touch pitch location mapping per ball" tag="Visual" />
            <FeatureCard icon={<WagonWheelSvgIcon size={24} />} title="Wagon Wheel" desc="Shot direction tracking & line vectors" tag="Visual" />
            <FeatureCard icon="🎯" title="Ball Tracker" desc="Delivery length & line tracking" tag="Analytics" />
            <FeatureCard icon="📊" title="Over Manhattan" desc="Over-by-over run & wicket rate" tag="Stats" />
            <FeatureCard icon="🐍" title="Innings Worm" desc="Cumulative score progression curves" tag="Stats" />
            <FeatureCard icon="📄" title="PDF Reports" desc="Export comprehensive match & net PDFs" tag="Export" />
          </ScrollView>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 14,
    backgroundColor: '#092414',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#164227',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2e7d32',
  },
  logoBadgeIcon: { fontSize: 22 },
  brandName: { color: '#f0c040', fontSize: 24, fontWeight: 'bold', letterSpacing: 0.5 },
  brandSubtitle: { color: '#a5d6a7', fontSize: 12, fontWeight: '500' },
  proPill: {
    backgroundColor: 'rgba(240, 192, 64, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0c040',
  },
  proPillText: { color: '#f0c040', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },

  graphicContainer: { alignItems: 'center', marginVertical: 8, paddingHorizontal: 16 },

  highlightStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  hItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  hIconBox: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hIconText: { fontSize: 13, lineHeight: 16 },
  hText: { color: '#c8e6c9', fontSize: 11, fontWeight: '600' },
  hDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#4caf50' },

  actionContainer: {
    paddingHorizontal: 18,
    marginTop: 10,
    gap: 14,
  },
  sectionHeader: {
    color: '#81c784',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.2,
    marginBottom: 2,
    marginLeft: 4,
  },
  actionCardNets: {
    backgroundColor: '#11331d',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#2e7d32',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  actionCardMatch: {
    backgroundColor: '#1c281f',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#d4a017',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  iconCircleGreen: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#1b5e20',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4caf50',
  },
  iconCircleGold: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#3e2723',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f0c040',
  },
  badgeNets: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4caf50',
  },
  badgeNetsText: { color: '#81c784', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  badgeLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(211, 47, 47, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ef5350',
  },
  livePulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ff5252' },
  badgeLiveText: { color: '#ff8a80', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },

  cardTitleLight: { color: '#ffffff', fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
  cardSubLight: { color: '#b0bec5', fontSize: 12, lineHeight: 18, marginBottom: 16 },

  cardFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  cardBtnTextGreen: { color: '#81c784', fontSize: 14, fontWeight: 'bold' },
  cardBtnTextGold: { color: '#ffe082', fontSize: 14, fontWeight: 'bold' },

  featuresSection: { marginTop: 24 },
  featuresSectionTitle: {
    color: '#81c784',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.2,
    marginBottom: 12,
    paddingHorizontal: 22,
  },
  featuresScroll: { paddingHorizontal: 18, gap: 12 },
  featureCard: {
    backgroundColor: '#122c1b',
    borderRadius: 16,
    padding: 14,
    width: 135,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  featureEmojiBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  featureEmoji: { fontSize: 20 },
  featureTitle: { color: '#ffffff', fontSize: 13, fontWeight: 'bold', marginBottom: 4 },
  featureDesc: { color: '#90a4ae', fontSize: 10, lineHeight: 14, marginBottom: 8 },
  featureTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(240, 192, 64, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  featureTagText: { color: '#ffe082', fontSize: 9, fontWeight: '600' },
});
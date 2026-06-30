// Claude 디자인 토큰 — 따뜻하고 세련된 부모 친화 톤
import { Platform, ViewStyle } from 'react-native';

export const colors = {
  bg: '#F7F3EC',       // 따뜻한 아이보리 배경
  bg2: '#F1EADD',      // 한 톤 깊은 샌드(섹션 구분)
  card: '#FFFFFF',
  ink: '#23211C',      // 본문 텍스트(웜 블랙)
  sub: '#8B8576',      // 보조 텍스트
  accent: '#CC7A57',   // Claude 코랄/테라코타
  accentDeep: '#B5613E', // 진한 코랄(강조·링크)
  accentSoft: '#F6E6DA', // 피치 패널
  peach: '#F6E6DA',
  green: '#7E8C6A',    // 차분한 세이지 보조
  gold: '#D8A23C',     // 포인트(별·뱃지)
  line: '#ECE3D4',
  ink0: '#FFFFFF',
};

export const radius = {
  card: 22,
  button: 16,
  chip: 999,
  pill: 999,
};

export const spacing = {
  screen: 20,
  gap: 12,
};

export const typography = {
  title: 27,
  subtitle: 19,
  body: 15,
  caption: 13,
  headTracking: -0.4 as const,
};

// 부드러운 그림자: 웹은 boxShadow, 네이티브는 shadow*/elevation (deprecation 경고 방지)
function mkShadow(y: number, blur: number, opacity: number, elevation: number, rgb = '90,60,35', color = '#5A3C1E'): ViewStyle {
  return Platform.select({
    web: { boxShadow: `0px ${y}px ${blur}px rgba(${rgb},${opacity})` } as unknown as ViewStyle,
    default: {
      shadowColor: color,
      shadowOpacity: opacity,
      shadowRadius: blur,
      shadowOffset: { width: 0, height: y },
      elevation,
    } as ViewStyle,
  }) as ViewStyle;
}

export const shadows = {
  card: mkShadow(10, 18, 0.1, 3),
  soft: mkShadow(5, 10, 0.08, 2),
  accent: mkShadow(10, 16, 0.35, 4, '181,97,62', '#B5613E'),
};

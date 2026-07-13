import type { CSSProperties } from 'vue'

export type AchievementColorStyle = CSSProperties & Record<`--${string}`, string>

export function achievementRatio(score: number, maxScore: number) {
  if (maxScore <= 0) return 0
  return Math.max(0, Math.min(1, score / maxScore))
}

export function achievementColorStyle(score: number, maxScore: number): AchievementColorStyle {
  const ratio = achievementRatio(score, maxScore)
  if (score <= 0) {
    return {
      '--achievement-bg': '#666666',
      '--achievement-color': '#e8e8e8',
      '--achievement-border': 'rgba(255, 255, 255, 0.22)',
    }
  }
  if (ratio <= 0.5) {
    return {
      '--achievement-bg': '#6f1d1b',
      '--achievement-color': '#fff1f1',
      '--achievement-border': '#b23a35',
    }
  }
  if (ratio <= 0.75) {
    return {
      '--achievement-bg': '#f2c94c',
      '--achievement-color': '#2f2500',
      '--achievement-border': '#ffe08a',
    }
  }
  return {
    '--achievement-bg': '#2f8f46',
    '--achievement-color': '#f0fff4',
    '--achievement-border': '#65d883',
  }
}

export const DesignSystem = {
  colors: {
    backgrounds: {
      pageFill: '#EDE5D4',
      cardBg: '#E8DCC8',
      taskChecked: '#DDD0B8',
      taskUnchecked: '#E5D9C4',
    },
    text: {
      primary: '#3A3025',
      secondary: '#8A7A65',
      timerDigits: '#B85C2A',
      sessionLabel: '#5A7A55',
      cta: '#FFFFFF',
    },
    interactive: {
      ctaFill: '#A8431A',
      resetBorder: '#8A6040',
    },
    sudoku: {
      cellSelected: '#DDD0B8',
      cellRelated: '#E5D9C4',
      cellErrorBg: 'rgba(192, 57, 43, 0.08)',
      cellErrorText: '#C0392B',
      cellSolved: '#5A7A55',
      notes: '#8A7A65',
      numpadDisabled: '#C8BAA0',
    },
  },
  shadows: {
    statsCard: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 2,
    },
    ctaButton: {
      shadowColor: '#A8431A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 6,
    },
  },
  fonts: {
    display: 'PlayfairDisplay_700Bold',
    bodyRegular: 'DMSans_400Regular',
    bodyMedium: 'DMSans_500Medium',
    bodyBold: 'DMSans_700Bold',
  },
} as const;

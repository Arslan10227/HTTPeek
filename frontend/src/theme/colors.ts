export interface ColorPreset {
  name: string;
  hex: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  darkPrimaryContainer: string;
  darkOnPrimaryContainer: string;
}

export const ColorMapping: Record<string, ColorPreset> = {
  Blue: {
    name: 'Blue',
    hex: '#2196F3',
    primaryContainer: '#D0E4FF',
    onPrimaryContainer: '#001D36',
    darkPrimaryContainer: '#004A77',
    darkOnPrimaryContainer: '#D0E4FF',
  },
  Pink: {
    name: 'Pink',
    hex: '#E91E63',
    primaryContainer: '#FFD9E2',
    onPrimaryContainer: '#3B071D',
    darkPrimaryContainer: '#7D2948',
    darkOnPrimaryContainer: '#FFD9E2',
  },
  Red: {
    name: 'Red',
    hex: '#F44336',
    primaryContainer: '#FFDAD6',
    onPrimaryContainer: '#410002',
    darkPrimaryContainer: '#93000A',
    darkOnPrimaryContainer: '#FFDAD6',
  },
  Purple: {
    name: 'Purple',
    hex: '#673AB7',
    primaryContainer: '#EADDFF',
    onPrimaryContainer: '#21005D',
    darkPrimaryContainer: '#4F378B',
    darkOnPrimaryContainer: '#EADDFF',
  },
  Green: {
    name: 'Green',
    hex: '#4CAF50',
    primaryContainer: '#C4EED0',
    onPrimaryContainer: '#00210E',
    darkPrimaryContainer: '#00522B',
    darkOnPrimaryContainer: '#C4EED0',
  },
  Teal: {
    name: 'Teal',
    hex: '#009688',
    primaryContainer: '#B2DFDB',
    onPrimaryContainer: '#00201D',
    darkPrimaryContainer: '#004F48',
    darkOnPrimaryContainer: '#B2DFDB',
  },
  Cyan: {
    name: 'Cyan',
    hex: '#00BCD4',
    primaryContainer: '#B2EBF2',
    onPrimaryContainer: '#002022',
    darkPrimaryContainer: '#004F54',
    darkOnPrimaryContainer: '#B2EBF2',
  },
  Orange: {
    name: 'Orange',
    hex: '#FF9800',
    primaryContainer: '#FFE0B2',
    onPrimaryContainer: '#331B00',
    darkPrimaryContainer: '#804500',
    darkOnPrimaryContainer: '#FFE0B2',
  },
  Yellow: {
    name: 'Yellow',
    hex: '#F57F17',
    primaryContainer: '#FFF9C4',
    onPrimaryContainer: '#2E2000',
    darkPrimaryContainer: '#705000',
    darkOnPrimaryContainer: '#FFF9C4',
  },
  Grey: {
    name: 'Grey',
    hex: '#9E9E9E',
    primaryContainer: '#E0E0E0',
    onPrimaryContainer: '#1F1F1F',
    darkPrimaryContainer: '#424242',
    darkOnPrimaryContainer: '#E0E0E0',
  },
};

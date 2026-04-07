import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.crosscity.hub',
  appName: 'CrossCity Hub',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;

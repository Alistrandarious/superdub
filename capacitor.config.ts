import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.superdub.app',
  appName: 'Superdub',
  // CRA emits the production bundle to build/
  webDir: 'build',
  server: {
    androidScheme: 'https',
  },
};

export default config;

export const logInfo = (msg: string): void => console.log(`ℹ️ ${msg}`);

export const logSuccess = (msg: string): void => console.log(`✅ ${msg}`);

export const logError = (msg: string, e?: any): void => {
  if (e) {
    console.error(`❌ ${msg}`, e);
  } else {
    console.error(`❌ ${msg}`);
  }
};

export const logWarn = (msg: string): void => console.warn(`⚠️ ${msg}`);

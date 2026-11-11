let version = 0;

export const getSessionVersion = (): number => version;
export const bumpSessionVersion = (): number => ++version;

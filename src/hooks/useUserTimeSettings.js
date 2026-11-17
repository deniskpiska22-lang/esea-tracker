import { useSyncExternalStore } from 'react';
import { subscribeUserTime, getUserTimeSnapshot } from '../utils/userTime.js';
const serverSnapshot = () => '';
export function useUserTimeSettings() {
  return useSyncExternalStore(subscribeUserTime, getUserTimeSnapshot, serverSnapshot);
}

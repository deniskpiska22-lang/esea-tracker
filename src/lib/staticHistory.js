import base from 'virtual:history-archive';
import { createHistoryLoader } from '../utils/historyLoader.js';

const loader = createHistoryLoader(base);
export const EMPTY_HISTORY = Object.freeze([]);
export const EMPTY_PLAYER_HISTORY = Object.freeze({ stats: {}, matches: EMPTY_HISTORY });
export const loadStaticHistory = loader.load;
export const loadRecentStaticMatches = loader.recent;

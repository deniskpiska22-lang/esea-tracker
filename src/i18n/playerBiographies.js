import { currentLanguage } from './languages.js';
const labels = {ru:'Возраст',en:'Age',de:'Alter',pt:'Idade',es:'Edad',fr:'Âge',it:'Età'};
export function playerAgeLabel(language = currentLanguage()) { return labels[language] || labels.en; }

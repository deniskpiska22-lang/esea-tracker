// Team-provided biographies. Keep the FACEIT identity stable through renames.
// Ages were supplied on this date; do not infer a date of birth from an age.
export const playerBiographies = {
  'e214d81d-cf71-44d6-9a68-b7e6cca9d7e2': { realName: 'Ivan Dubov', age: 23, ageConfirmedOn: '2026-11-19' },
  'b5e9492c-1cb1-4c93-b2c5-b5826ac4ff9e': { realName: 'Andrey Kosarev', age: 22, ageConfirmedOn: '2026-11-19' },
  '3dad5d84-2a16-4044-8a27-d473f0f6e353': { realName: 'Konstantin Furzikov', age: 18, ageConfirmedOn: '2026-11-19' },
  'c3c2e18a-3610-492f-b1bf-555d67e2d494': { realName: 'Ilya Kireev', age: 25, ageConfirmedOn: '2026-11-19' },
};
export function playerBiography(faceitId) {
  return playerBiographies[String(faceitId || '').toLowerCase()] || null;
}

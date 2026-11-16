// Profile links approved by the account holder. These are display identities
// on ESEA Tracker; original FACEIT accounts and raw match data remain intact.
export const linkedPlayerProfiles = [{
  id: '0871c9f5-cacc-460e-a44a-c85bb414ad5b',
  nickname: 'LisssTzz',
  aliases: ['-LisssTzz-'],
  linkedIds: ['f90b8c34-3324-4686-b078-ab86c5e14f40'],
}];

export function linkedPlayerProfile(key) {
  const value = String(key || '').trim().toLowerCase();
  return linkedPlayerProfiles.find(profile => [
    profile.id, profile.nickname, ...profile.aliases, ...profile.linkedIds,
  ].some(alias => alias.toLowerCase() === value)) || null;
}

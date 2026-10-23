// The same stable partition is used by the build and the browser. A page
// downloads a small JSON bucket instead of compiling the entire archive.
export function historyBucket(key) {
  let hash = 2166136261;
  for (const character of String(key)) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  return (hash >>> 0 & 255).toString(16).padStart(2, '0');
}

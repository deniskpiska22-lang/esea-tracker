// Root CSS zoom shrinks pixels, while browser zoom also changes the effective
// viewport. Mirror the latter for responsive breakpoints and viewport units.
export const DESKTOP_DENSITY = 0.8;
const DESKTOP = '(min-width: 1024px)';
const MOBILE = '(max-width: 1023.98px)';
const number = value => String(Number(value.toFixed(5)));
export function scaledWidthQuery(query) {
  return query
    .replace(/(\b(?:min-|max-)?width\s*(?::|[<>=]+)\s*)(\d*\.?\d+)(px|rem|em)\b/gi,
      (_, prefix, value, unit) => prefix + number(Number(value) * DESKTOP_DENSITY) + unit)
    .replace(/(\d*\.?\d+)(px|rem|em)(\s*[<>=]+\s*width\b)/gi,
      (_, value, unit, suffix) => number(Number(value) * DESKTOP_DENSITY) + unit + suffix);
}
export function expandedViewportUnits(value) {
  return value.replace(/(-?(?:\d+\.?\d*|\.\d+))(dvh|svh|lvh|vh|dvw|svw|lvw|vw|vmin|vmax)\b/gi,
    (_, amount, unit) => number(Number(amount) / DESKTOP_DENSITY) + unit);
}
const withCondition = (query, condition) => query.split(',').map(part => `${part.trim()} and ${condition}`).join(', ');
export function desktopDensity() {
  return {
    postcssPlugin: 'esea-desktop-density',
    OnceExit(root) {
      // Vite also processes inline HTML styles. The root zoom rule already
      // compensates its own viewport and must not be transformed again.
      if (root.nodes.some(node => node.type === 'comment' && node.text.trim() === 'esea-density-root')) return;
      // Visit existing inner queries first. Newly inserted desktop guards must
      // never themselves be rescaled. Narrow screens keep their original CSS.
      const queries = [];
      root.walkAtRules('media', rule => { if (scaledWidthQuery(rule.params) !== rule.params) queries.push(rule); });
      for (const rule of queries.reverse()) {
        const desktop = rule.clone({ params: withCondition(scaledWidthQuery(rule.params), DESKTOP) });
        rule.params = withCondition(rule.params, MOBILE);
        rule.after(desktop);
      }
      const rules = new Set();
      root.walkDecls(decl => {
        if (decl.parent.type === 'rule' && expandedViewportUnits(decl.value) !== decl.value) rules.add(decl.parent);
      });
      for (const rule of rules) {
        // Ignore animation frames: no site animation uses viewport dimensions.
        if (/keyframes$/.test(rule.parent.name || '')) continue;
        const scaled = rule.clone({ nodes: [] });
        for (const decl of rule.nodes) if (decl.type === 'decl' && expandedViewportUnits(decl.value) !== decl.value) {
          scaled.append(decl.clone({ value: expandedViewportUnits(decl.value) }));
        }
        if (scaled.nodes.length) rule.after(`@media screen and ${DESKTOP} { ${scaled.toString()} }`);
      }
    },
  };
}

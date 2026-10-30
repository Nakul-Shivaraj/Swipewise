import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Tailwind theme from DESIGN.md (Issue #7)', () => {
  const rootDir = path.resolve(__dirname, '../../..');
  const webSrcDir = path.resolve(__dirname);
  const themeCssPath = path.join(webSrcDir, 'theme.css');
  const indexCssPath = path.join(webSrcDir, 'index.css');
  const packageJsonPath = path.join(rootDir, 'package.json');
  const signUpPagePath = path.join(webSrcDir, 'pages/SignUpPage.tsx');
  const appTsxPath = path.join(webSrcDir, 'App.tsx');

  it('AC4: package.json defines design:theme script that works on Windows', () => {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    expect(pkg.scripts).toBeDefined();
    expect(pkg.scripts['design:theme']).toBeDefined();
    expect(pkg.scripts['design:theme']).toContain('design.md.cmd');
    expect(pkg.scripts['design:theme']).toContain('docs/DESIGN.md');
    expect(pkg.scripts['design:theme']).toContain('css-tailwind');
    expect(pkg.scripts['design:theme']).toContain('apps/web/src/theme.css');
  });

  it('AC4: theme.css exists and defines DESIGN.md tokens', () => {
    expect(fs.existsSync(themeCssPath)).toBe(true);
    const content = fs.readFileSync(themeCssPath, 'utf8');
    expect(content).toContain('@theme');
    expect(content).toContain('--color-primary: #2f7d4f');
    expect(content).toContain('--color-primary-pressed: #256640');
    expect(content).toContain('--color-primary-tint: #d6e8d9');
    expect(content).toContain('--color-background: #e7eed8');
    expect(content).toContain('--color-background-deep: #dce6cb');
    expect(content).toContain('--color-ink: #1c2a1e');
    expect(content).toContain('--color-ink-muted: #5d6b5b');
    expect(content).toContain('--color-error: #b3261e');
  });

  it('AC4: index.css imports the generated theme', () => {
    const content = fs.readFileSync(indexCssPath, 'utf8');
    expect(content).toMatch(/@import\s+["']\.\/theme\.css["'];/);
  });

  it('AC4: web components do not use raw hex color values for design tokens', () => {
    const signUpContent = fs.readFileSync(signUpPagePath, 'utf8');
    const appContent = fs.readFileSync(appTsxPath, 'utf8');

    // Key design token hex codes from DESIGN.md that should be replaced with theme classes
    const forbiddenHexes = [
      '#2F7D4F',
      '#2f7d4f',
      '#256640',
      '#D6E8D9',
      '#d6e8d9',
      '#E7EED8',
      '#e7eed8',
      '#DCE6CB',
      '#dce6cb',
      '#1C2A1E',
      '#1c2a1e',
      '#5D6B5B',
      '#5d6b5b',
      '#B3261E',
      '#b3261e',
    ];

    for (const hex of forbiddenHexes) {
      expect(signUpContent).not.toContain(hex);
      expect(appContent).not.toContain(hex);
    }
  });
});

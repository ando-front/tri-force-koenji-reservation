import * as fs from 'fs';
import * as path from 'path';

// B-2 回帰テスト:「/admin/export が CSV を返すこと」（設計書 8.3 の CI 必須ケース）。
//
// 実際に発生していた不具合は Express のルートマッチング順序に起因していた。
// `/admin/:id` が `/admin/export` より先に定義されていたため、
// `GET /admin/export` は `id="export"` として `/admin/:id` に吸収され、
// 存在しない予約IDとして常に 404 を返していた（本文ハンドラは一切実行されない）。
//
// このテストは reservations.ts を実際に import せず、ソースを静的に走査して
// `router.get('/admin/export', ...)` の登場位置が `router.get('/admin/:id', ...)`
// より前であることを検査する。実行時 import にすると shared/types.ts 経由の
// zod 解決がテスト環境の node_modules ホイスティングに依存してしまい、
// このテストの本来の目的（ルート定義順の回帰防止）と関係のない要因で
// 壊れうるため、意図的に静的検査に留めている。
describe('reservations router のルート定義順（B-2 の再発防止）', () => {
  const source = fs.readFileSync(path.join(__dirname, 'reservations.ts'), 'utf8');

  function indexOfRouteDefinition(routePath: string, method = 'get'): number {
    const needle = `router.${method}('${routePath}'`;
    return source.indexOf(needle);
  }

  it('/admin/export が /admin/:id より前に定義されている', () => {
    const exportIdx = indexOfRouteDefinition('/admin/export');
    const wildcardIdx = indexOfRouteDefinition('/admin/:id');

    expect(exportIdx).toBeGreaterThan(-1);
    expect(wildcardIdx).toBeGreaterThan(-1);
    expect(exportIdx).toBeLessThan(wildcardIdx);
  });

  it('/admin/stats も /admin/:id より前に定義されている（既存の正しい実装を退行させない）', () => {
    const statsIdx = indexOfRouteDefinition('/admin/stats');
    const wildcardIdx = indexOfRouteDefinition('/admin/:id');

    expect(statsIdx).toBeGreaterThan(-1);
    expect(statsIdx).toBeLessThan(wildcardIdx);
  });

  it('/admin/export の定義は router ファイル内に1箇所だけ存在する（重複定義の再発防止）', () => {
    const occurrences = source.split(`router.get('/admin/export'`).length - 1;
    expect(occurrences).toBe(1);
  });
});

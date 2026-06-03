import { test, expect } from '@playwright/test';

test.describe('Mongo-backed API connectivity', () => {
  test('article endpoint responds successfully', async ({ request }) => {
    const articleResponse = await request.get('/api/article/get-published-posts/');
    const articleBody = await articleResponse.text();
    expect(
      articleResponse.ok(),
      `Article endpoint should return a successful status. Received HTTP ${articleResponse.status()} with body: ${articleBody}`
    ).toBeTruthy();
    expect(articleResponse.status(), 'Article endpoint should return HTTP 201').toBe(201);

    const articlePayload = JSON.parse(articleBody);
    expect(Array.isArray(articlePayload), 'Article payload should be an array').toBeTruthy();
  });

  test('map endpoint responds successfully', async ({ request }) => {
    const mapResponse = await request.get('/api/sites/get-sites/Production');
    const mapBody = await mapResponse.text();
    expect(
      mapResponse.ok(),
      `Map endpoint should return a successful status. Received HTTP ${mapResponse.status()} with body: ${mapBody}`
    ).toBeTruthy();
    expect(mapResponse.status(), 'Map endpoint should return HTTP 201').toBe(201);

    const mapPayload = JSON.parse(mapBody);
    expect(mapPayload?.type, 'Map payload should be a GeoJSON FeatureCollection').toBe('FeatureCollection');
    expect(Array.isArray(mapPayload?.features), 'Map payload should contain a features array').toBeTruthy();
  });
});

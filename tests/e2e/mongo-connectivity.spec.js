import { test, expect } from '@playwright/test';

test.describe('Mongo-backed API connectivity', () => {
  test('blog endpoint responds successfully', async ({ request }) => {
    const blogResponse = await request.get('/api/blog/get-published-posts/');
    const blogBody = await blogResponse.text();
    expect(
      blogResponse.ok(),
      `Blog endpoint should return a successful status. Received HTTP ${blogResponse.status()} with body: ${blogBody}`
    ).toBeTruthy();
    expect(blogResponse.status(), 'Blog endpoint should return HTTP 201').toBe(201);

    const blogPayload = JSON.parse(blogBody);
    expect(Array.isArray(blogPayload), 'Blog payload should be an array').toBeTruthy();
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

const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type,x-local-token',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
};

function jsonRoute(route, body) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: corsHeaders,
    body: JSON.stringify(body),
  });
}

test('Spectra settings and chat stay read-only until Apply', async ({ page }) => {
  const requests = [];

  await page.route('http://127.0.0.1:3000/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: corsHeaders });
    }

    if (url.pathname.endsWith('/health')) {
      return jsonRoute(route, {
        ok: true,
        available: true,
        service: 'prism-spectra',
        mockExecutors: true,
      });
    }

    if (url.pathname.endsWith('/local/status')) {
      return jsonRoute(route, {
        ok: true,
        gateway: { mode: 'mock' },
        disk: { availableHuman: '100 GiB' },
        storage: {
          ollamaModels: { human: '12 GiB' },
          spectraDemo: { human: '2 MiB' },
        },
        memory: { freePercent: 60 },
        ollama: { loadedModels: [] },
        process: { topCpu: { rows: [{ command: 'node', cpuPercent: 1 }] } },
        thermal: { available: true, warning: false },
      });
    }

    if (url.pathname.endsWith('/ai/request')) {
      const body = request.postDataJSON();
      requests.push(body);

      if (body.intent === 'focus-ai-bridge-smoke-test') {
        return jsonRoute(route, {
          ok: true,
          provider: 'ollama',
          model: 'qwen3:1.7b',
          dataBoundary: 'local',
          structuredResponse: {
            reply: 'Prism Focus is connected.',
            proposedTasks: [],
            proposedSchedule: [],
            followUpQuestion: '',
          },
        });
      }

      return jsonRoute(route, {
        ok: true,
        provider: 'ollama',
        model: 'qwen3.5:9b',
        dataBoundary: 'local',
        structuredResponse: {
          reply: 'Take one gentle ten-minute reset.',
          proposedTasks: [{
            text: 'Ten-minute reset',
            estimatedMins: 10,
            note: 'A deliberately small next step.',
            taskScope: 'day',
          }],
          proposedSchedule: [],
          followUpQuestion: '',
        },
      });
    }

    return route.fulfill({ status: 404, headers: corsHeaders });
  });

  await page.goto(pathToFileURL(path.join(process.cwd(), 'index.html')).href);
  await page.getByRole('button', { name: /Done for now/ }).click();
  await expect(page.getByText('focus.', { exact: true })).toBeVisible();
  const initialTaskCount = await page.evaluate(() => tasks.length);

  const assistantMenu = page.locator('summary').filter({ hasText: 'Assistant' });
  await assistantMenu.click();
  await page.getByRole('button', { name: /AI settings/ }).click();
  await expect(page.getByText('Spectra AI gateway', { exact: true })).toBeVisible();
  await expect(page.getByText('Local resource/status monitor', { exact: true })).toBeVisible();

  await page.locator('input[onchange="settingsSetAiMaster(this.checked)"]').check();
  await page.getByRole('button', { name: 'Use dev defaults' }).click();
  await page.getByRole('button', { name: 'Test Spectra' }).click();

  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await expect(page.getByText(/gateway: mock/)).toBeVisible();

  await page.locator('button[onclick="closeSettings()"]').click();
  await assistantMenu.click();
  await page.getByRole('button', { name: /Chat/ }).click();

  const composer = page.locator('#chat-composer');
  await composer.fill('Suggest one gentle ten-minute next step.');
  await page.getByRole('button', { name: 'Send' }).click();

  await expect(page.getByText('Take one gentle ten-minute reset.', { exact: true })).toBeVisible();
  await expect(page.getByText('Proposed Focus changes', { exact: true })).toBeVisible();
  await expect(page.getByText('Ten-minute reset', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply proposed tasks' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dismiss' })).toBeVisible();

  expect(await page.evaluate(() => tasks.length)).toBe(initialTaskCount);
  expect(requests).toHaveLength(2);
  expect(requests[0]).toMatchObject({
    intent: 'focus-ai-bridge-smoke-test',
    riskClass: 'read-only',
    aiRole: 'classifier',
    maxOutputTokens: 80,
  });
  expect(requests[1]).toMatchObject({
    intent: 'focus-chat-message',
    riskClass: 'read-only',
    aiRole: 'planner',
    maxOutputTokens: 900,
  });
  expect(requests[1].input.instruction).toContain('Return ONLY valid JSON');
});

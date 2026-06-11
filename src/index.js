const NOTION_API_VERSION = '2026-03-11';
const CANONICAL_DATA_SOURCE_ID = '27ffd6ba-fc55-4c0d-8f00-d78724d33a61';
const DEFAULT_ALLOWED_ORIGIN = 'https://oleg3479881328-code.github.io';

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'Pragma': 'no-cache',
      ...extraHeaders,
    },
  });
}

function corsHeaders(request, env) {
  const requestOrigin = request.headers.get('Origin') || '';
  const allowedOrigin = env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin': requestOrigin === allowedOrigin ? requestOrigin : allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Bridge-Key',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function normalizeUuid(value) {
  const compact = String(value || '').trim().toLowerCase().replace(/[^0-9a-f]/g, '');
  if (!/^[0-9a-f]{32}$/.test(compact)) return null;
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}

function richTextToPlainText(property) {
  const items = property?.rich_text;
  if (!Array.isArray(items)) return '';
  return items.map((item) => item?.plain_text || item?.text?.content || '').join('');
}

function titleToPlainText(property) {
  const items = property?.title;
  if (!Array.isArray(items)) return '';
  return items.map((item) => item?.plain_text || item?.text?.content || '').join('');
}

function timingSafeEqual(a, b) {
  const left = new TextEncoder().encode(String(a || ''));
  const right = new TextEncoder().encode(String(b || ''));
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

async function retrieveNotionPage(pageId, env) {
  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${env.NOTION_ACCESS_TOKEN}`,
      'Notion-Version': NOTION_API_VERSION,
      Accept: 'application/json',
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body?.message || `Notion API returned ${response.status}`;
    throw new Error(detail);
  }
  return body;
}

function verifyCanonicalLibraryPage(page) {
  return page?.parent?.type === 'data_source_id' && page?.parent?.data_source_id === CANONICAL_DATA_SOURCE_ID;
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders(request, env);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    if (url.pathname === '/health') {
      return json({ ok: true, service: 'prompt-launcher-bridge' }, 200, headers);
    }

    if (url.pathname !== '/api/prompt' || request.method !== 'GET') {
      return json({ error: 'Not found' }, 404, headers);
    }

    if (!env.NOTION_ACCESS_TOKEN || !env.BRIDGE_ACCESS_KEY) {
      return json({ error: 'Bridge is not configured' }, 503, headers);
    }

    const suppliedKey = request.headers.get('X-Bridge-Key') || '';
    if (!timingSafeEqual(suppliedKey, env.BRIDGE_ACCESS_KEY)) {
      return json({ error: 'Unauthorized' }, 401, headers);
    }

    const pageId = normalizeUuid(url.searchParams.get('page'));
    if (!pageId) {
      return json({ error: 'Invalid Notion page id' }, 400, headers);
    }

    try {
      const page = await retrieveNotionPage(pageId, env);
      if (!verifyCanonicalLibraryPage(page)) {
        return json({ error: 'Page is outside the canonical prompt library' }, 403, headers);
      }

      const prompt = richTextToPlainText(page.properties?.['Промпт']);
      const title = titleToPlainText(page.properties?.['Название']);

      if (!prompt.trim()) {
        return json({ error: 'Prompt field is empty' }, 404, headers);
      }

      return json({ pageId, title, prompt }, 200, headers);
    } catch (error) {
      return json({ error: error.message || 'Failed to load prompt from Notion' }, 502, headers);
    }
  },
};

// SeWalk AI — Netlify Edge Function
// Fixed: correct model name, CORS preflight, robust error handling

const ALLOWED_ORIGINS = [
  'https://sewalk-ai.netlify.app',
  'https://genuine-otter-85f43c.netlify.app',
  'http://localhost:3000',
  'http://localhost:8888'  // Netlify dev local
];

const CORS_HEADERS = (origin) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
});

export default async (request) => {
  const origin = request.headers.get('origin') || '';
  const isAllowed = ALLOWED_ORIGINS.includes(origin);

  // --- Handle CORS preflight (OPTIONS) ---
  // Browsers ALWAYS send this before POST — must return 200 or the request dies
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS(isAllowed ? origin : ALLOWED_ORIGINS[0]),
    });
  }

  // --- Only allow POST ---
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // --- Origin check ---
  if (!isAllowed) {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const body = await request.json();

    // --- Get API key from Netlify environment ---
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in Netlify environment variables.');
    }

    // --- Filter out system role (Gemini doesn't accept it in contents) ---
    const contents = (body.messages || [])
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

    // Gemini 3.1 Flash-Lite Preview — fastest, most cost-efficient model (March 2026)
    const MODEL = 'gemini-3.1-flash-lite-preview';

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: body.system || 'You are a helpful assistant.' }],
          },
          contents: contents,
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.7,
          },
        }),
      }
    );

    const data = await geminiResponse.json();

    // --- Surface Gemini API errors clearly ---
    if (!geminiResponse.ok || data?.error) {
      const errMsg = data?.error?.message || `Gemini API error ${geminiResponse.status}`;
      throw new Error(errMsg);
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      'Sorry, I could not generate a response.';

    return new Response(
      JSON.stringify({ content: [{ type: 'text', text }] }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS(origin),
        },
      }
    );

  } catch (err) {
    console.error('SeWalk AI chat error:', err.message);
    return new Response(
      JSON.stringify({
        content: [{ type: 'text', text: `⚠️ Server error: ${err.message}` }],
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS(origin),
        },
      }
    );
  }
};

// NOTE: path config is already defined in netlify.toml — no export needed here

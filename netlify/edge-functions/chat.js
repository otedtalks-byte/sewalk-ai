export default async (request) => {
  // --- 1. YOUR EXACT ORIGIN LOGIC (UNTOUCHED) ---
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const origin = request.headers.get('origin') || '';
  const allowed = [
    'https://sewalk-ai.netlify.app',
    'https://genuine-otter-85f43c.netlify.app',
    'http://localhost:3000'
  ];
  if (!allowed.includes(origin)) {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const body = await request.json();
    const apiKey = Deno.env.get('GEMINI_API_KEY');

    // --- 2. THE ONLY FIX: FILTER SYSTEM ROLE ---
    // Gemini 3.1 WILL crash/ghost if 'system' is in the contents array.
    const contents = body.messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

    // --- 3. MODEL UPDATED TO 3.1 FLASH-LITE (2026 META) ---
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: body.system }] },
          contents: contents,
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.7
          }
        })
      }
    );

    const data = await geminiResponse.json();

    // --- 4. YOUR EXACT RESPONSE MAPPING (UNTOUCHED) ---
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text 
      || data?.error?.message 
      || JSON.stringify(data);

    return new Response(JSON.stringify({
      content: [{ type: 'text', text: text }]
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (err) {
    // --- 5. YOUR EXACT ERROR HANDLING (UNTOUCHED) ---
    return new Response(JSON.stringify({
      content: [{ type: 'text', text: 'Error: ' + err.message }]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// --- 6. YOUR EXACT CONFIG (UNTOUCHED) ---
export const config = { path: '/api/chat' };

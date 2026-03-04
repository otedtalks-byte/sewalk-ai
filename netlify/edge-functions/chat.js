export default async (request) => {
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

    const contents = body.messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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

    // Return full Gemini response for debugging
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
    return new Response(JSON.stringify({
      content: [{ type: 'text', text: 'Error: ' + err.message }]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = { path: '/api/chat' };

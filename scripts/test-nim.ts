async function main() {
  const apiKey = "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";
  
  const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'z-ai/glm-5.2',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say hello in one sentence.' }
      ],
      max_tokens: 64,
      temperature: 0.3,
    }),
  });

  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Response:', text.substring(0, 500));
}

main().catch(console.error);

import { NextRequest, NextResponse } from 'next/server';
import { generateAIResponse } from '@/lib/ai-service';

// POST /api/ai/template — Generate a structured email template using AI
export async function POST(request: NextRequest) {
  try {
    const { prompt, tone = 'formal', category = 'general' } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const systemPrompt = `You are a professional email marketing copywriter and assistant.
Create a structured email template based on the user's instructions.
You must output a JSON object containing three fields:
1. "name": A concise, clear name for the email template.
2. "subject": An engaging subject line for the email.
3. "body": The main content of the email, structured nicely with paragraphs.

Placeholders: You MUST use the standard placeholders {{name}}, {{email}}, and {{company}} in the subject and body where appropriate so that the email can be personalized.

Tone of the email template: ${tone}.
Category of the template: ${category}.

Return ONLY the raw JSON object. Do not wrap it in markdown codeblocks.`;

    const userPrompt = `Generate a template for: "${prompt}"`;

    const responseText = await generateAIResponse(systemPrompt, userPrompt, true);
    
    // Parse the response
    let data;
    try {
      const cleanJson = responseText.replace(/```json/i, '').replace(/```/g, '').trim();
      data = JSON.parse(cleanJson);
    } catch (e) {
      console.error('Failed to parse AI JSON response:', responseText);
      return NextResponse.json({ 
        error: 'Failed to parse AI response into structured JSON. Please try again.' 
      }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('AI Template Generation error:', error);
    return NextResponse.json({ error: error.message || 'AI Template Generation failed.' }, { status: 500 });
  }
}

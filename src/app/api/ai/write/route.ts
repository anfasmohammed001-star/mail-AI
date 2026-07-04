import { NextRequest, NextResponse } from 'next/server';
import { generateAIResponse } from '@/lib/ai-service';

// POST /api/ai/write — Generate an email using AI
export async function POST(request: NextRequest) {
  try {
    const { prompt, tone = 'professional', context = '' } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const systemPrompt = `You are a professional email writing assistant. Write a well-structured, clear, and engaging email. 
Tone of the email: ${tone}.
Format of the output: Plain text only, do not include any subject headers, signatures, or metadata block unless requested. Output only the email body itself.`;

    const userPrompt = `Instructions for writing the email:\n${prompt}\n\nAdditional Context:\n${context}`;

    const text = await generateAIResponse(systemPrompt, userPrompt);
    return NextResponse.json({ text });
  } catch (error: any) {
    console.error('AI Write error:', error);
    return NextResponse.json({ error: error.message || 'AI Email writing failed.' }, { status: 500 });
  }
}

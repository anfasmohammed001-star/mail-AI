import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateAIResponse } from '@/lib/ai-service';

// POST /api/ai/reply — Generate an AI reply to a received email
export async function POST(request: NextRequest) {
  try {
    const { emailId, instruction = '' } = await request.json();

    if (!emailId) {
      return NextResponse.json({ error: 'Email ID is required' }, { status: 400 });
    }

    const email = await db.receivedEmail.findUnique({
      where: { id: emailId },
    });

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    const systemPrompt = `You are an AI Email Assistant. Generate a professional reply to the email provided by the user.
Format of the output: Plain text only, representing the body of the reply. Do not write subject lines, signature blocks, or recipient headings. Write in a helpful, polite, and professional tone.`;

    const userPrompt = `Incoming Email Subject: ${email.subject}
Incoming Email Sender: ${email.fromName || email.fromEmail}
Incoming Email Body:
${email.body || '(No body content)'}

Reply Instructions/Guidance:
${instruction || 'Acknowledge receipt and respond professionally.'}`;

    const replyDraft = await generateAIResponse(systemPrompt, userPrompt);

    // Save the reply draft back to the email record
    await db.receivedEmail.update({
      where: { id: emailId },
      data: {
        aiReplyDraft: replyDraft,
        aiReplyStatus: 'drafted',
      },
    });

    return NextResponse.json({ replyDraft });
  } catch (error: any) {
    console.error('AI Reply error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate AI reply' }, { status: 500 });
  }
}

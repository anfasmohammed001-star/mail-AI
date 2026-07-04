import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { processIncomingEmail } from '@/lib/email-processor';

// POST /api/simulate/inbox — simulate receiving emails for demo
export async function POST() {
  try {
    const contacts = await db.contact.findMany();
    if (contacts.length === 0) {
      return NextResponse.json({ error: 'No contacts found. Add contacts first.' }, { status: 400 });
    }

    const sampleSubjects = [
      'Re: Your recent email',
      'Question about pricing',
      'Meeting request',
      'Thank you for the update',
      'Unsubscribe from newsletter',
      'Support request',
      'Partnership opportunity',
      'Feedback on your product',
      'Follow-up from last week',
      'Invoice inquiry',
    ];

    const sampleBodies = [
      'Hi, thank you for reaching out. I would like to schedule a call to discuss further details. Let me know your availability this week.',
      'Could you provide more information about your pricing plans? We are evaluating several options and yours looks promising.',
      'Please remove me from your mailing list. I am no longer interested in receiving these emails.',
      'Thanks for the update! Everything looks good on our end. Looking forward to the next steps.',
      'I have a question regarding the integration. Are there any API limits we should be aware of?',
      'We would like to explore a potential partnership. Our team has reviewed your product and we are impressed.',
      'Just wanted to follow up on our conversation from last week. Have you had a chance to review the proposal?',
    ];

    const receivedEmails = [];
    const count = Math.min(contacts.length, 8);

    for (let i = 0; i < count; i++) {
      const contact = contacts[i];
      const email = await db.receivedEmail.create({
        data: {
          contactId: contact.id,
          fromEmail: contact.email,
          fromName: contact.name,
          subject: sampleSubjects[i % sampleSubjects.length],
          body: sampleBodies[i % sampleBodies.length],
        },
      });

      // Run AI and Response rules automatically on simulated inbox sync
      try {
        await processIncomingEmail(email.id);
      } catch (err) {
        console.error('Failed to run email automation worker on simulation:', err);
      }

      const updatedEmail = await db.receivedEmail.findUnique({
        where: { id: email.id },
      });
      receivedEmails.push(updatedEmail || email);
    }

    await db.activityLog.create({
      data: {
        action: 'RECEIVED',
        category: 'email',
        details: JSON.stringify({ count, simulated: true }),
      },
    });

    return NextResponse.json({ received: count, emails: receivedEmails }, { status: 201 });
  } catch (error) {
    console.error('Failed to simulate inbox:', error);
    return NextResponse.json({ error: 'Failed to simulate inbox' }, { status: 500 });
  }
}
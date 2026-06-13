import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import * as conversationRepo from "@/repositories/conversations";
import * as messageRepo from "@/repositories/conversations";

/**
 * GET /api/messages/whatsapp?contact_id={id}&phone={phone}
 * Get WhatsApp message history for a contact.
 *
 * Pre-migration contract:
 * - contact_id: required param (validated, but NOT used as clinicId filter)
 * - phone: used as external_id for conversation lookup
 * - channel: 'whatsapp' filter applied
 * - NO clinicId scoping — searches across ALL conversations with matching phone
 * - Returns messages sorted by created_at ascending
 *
 * Migrated to Drizzle, preserving exact original semantics.
 */
export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const contactId = searchParams.get("contact_id");
		const phone = searchParams.get("phone");

		// contact_id is required per contract, but NOT used for clinic scoping
		if (!contactId || !phone) {
			return NextResponse.json(
				{ error: "Missing required params: contact_id, phone" },
				{ status: 400 },
			);
		}

		// Find conversations by channel + phone, no clinic scoping (original behavior)
		const convRows = await conversationRepo.findByChannelAndExternalId(
			"whatsapp",
			phone,
		);

		if (convRows.length === 0) {
			return NextResponse.json({ messages: [] });
		}

		// Support multiple conversations (original used .in())
		const conversationIds = convRows.map((c) => c.id);

		// Fetch messages for all matching conversations
		const allMessages: Array<{
			id: string;
			direction: string;
			content: string;
			created_at: Date | null;
			metadata: Record<string, unknown>;
		}> = [];

		for (const conversationId of conversationIds) {
			const msgs = await messageRepo.findMessagesByConversation(
				conversationId,
				{ limit: 100 },
			);
			allMessages.push(
				...msgs.map((m) => ({
					id: m.id,
					direction: m.direction,
					content: m.content,
					created_at: m.createdAt,
					metadata: m.metadata,
				})),
			);
		}

		// Sort by created_at ascending (original order)
		allMessages.sort((a, b) => {
			const aTime = a.created_at?.getTime() ?? 0;
			const bTime = b.created_at?.getTime() ?? 0;
			return aTime - bTime;
		});

		return NextResponse.json({ messages: allMessages });
	} catch (error) {
		return handleApiError(error);
	}
}

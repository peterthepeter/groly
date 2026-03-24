import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { lists, items, listMembers, users } from '$lib/db/schema';
import { eq, count, sql } from 'drizzle-orm';
import { randomBytes } from 'crypto';

function now() { return Math.floor(Date.now() / 1000); }
function generateId() { return randomBytes(12).toString('base64url'); }

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const openCounts = db
		.select({ listId: items.listId, cnt: count(items.id).as('cnt') })
		.from(items)
		.where(eq(items.isChecked, false))
		.groupBy(items.listId)
		.as('open_counts');

	const memberCounts = db
		.select({ listId: listMembers.listId, cnt: count(listMembers.userId).as('mcnt') })
		.from(listMembers)
		.groupBy(listMembers.listId)
		.as('member_counts');

	// Eigene Listen
	const ownedLists = db
		.select({
			id: lists.id,
			name: lists.name,
			description: lists.description,
			iconId: lists.iconId,
			ownerId: lists.ownerId,
			ownerUsername: sql<string>`NULL`,
			createdAt: lists.createdAt,
			updatedAt: lists.updatedAt,
			openCount: sql<number>`COALESCE(${openCounts.cnt}, 0)`,
			memberCount: sql<number>`COALESCE(${memberCounts.cnt}, 0)`,
			isOwner: sql<number>`1`
		})
		.from(lists)
		.leftJoin(openCounts, eq(lists.id, openCounts.listId))
		.leftJoin(memberCounts, eq(lists.id, memberCounts.listId))
		.where(eq(lists.ownerId, user!.id))
		.all();

	// Geteilte Listen (wo User Member ist)
	let acceptedShared: typeof ownedLists = [];
	let pendingInvitations: { id: string; name: string; description: string | null; iconId: string | null; ownerId: string; ownerUsername: string | null; openCount: number; updatedAt: number }[] = [];
	try {
		const sharedLists = db
			.select({
				id: lists.id,
				name: lists.name,
				description: lists.description,
				iconId: lists.iconId,
				ownerId: lists.ownerId,
				ownerUsername: users.username,
				createdAt: lists.createdAt,
				updatedAt: lists.updatedAt,
				openCount: sql<number>`COALESCE(${openCounts.cnt}, 0)`,
				memberCount: sql<number>`0`,
				isOwner: sql<number>`0`,
				memberStatus: listMembers.status
			})
			.from(listMembers)
			.innerJoin(lists, eq(listMembers.listId, lists.id))
			.innerJoin(users, eq(lists.ownerId, users.id))
			.leftJoin(openCounts, eq(lists.id, openCounts.listId))
			.where(eq(listMembers.userId, user!.id))
			.all();

		acceptedShared = sharedLists.filter(l => l.memberStatus === 'accepted').map(l => ({ ...l, isOwner: false as unknown as number, pending: false })) as typeof ownedLists;
		pendingInvitations = sharedLists.filter(l => l.memberStatus === 'pending').map(l => ({
			id: l.id, name: l.name, description: l.description, iconId: l.iconId,
			ownerId: l.ownerId, ownerUsername: l.ownerUsername ?? null,
			openCount: l.openCount, updatedAt: l.updatedAt
		}));
	} catch {
		// Migration noch nicht gelaufen – alle geteilten Listen als accepted behandeln
		const fallback = db
			.select({
				id: lists.id, name: lists.name, description: lists.description,
				iconId: lists.iconId, ownerId: lists.ownerId, ownerUsername: users.username,
				createdAt: lists.createdAt, updatedAt: lists.updatedAt,
				openCount: sql<number>`COALESCE(${openCounts.cnt}, 0)`,
				memberCount: sql<number>`0`, isOwner: sql<number>`0`
			})
			.from(listMembers)
			.innerJoin(lists, eq(listMembers.listId, lists.id))
			.innerJoin(users, eq(lists.ownerId, users.id))
			.leftJoin(openCounts, eq(lists.id, openCounts.listId))
			.where(eq(listMembers.userId, user!.id))
			.all();
		acceptedShared = fallback.map(l => ({ ...l, isOwner: false as unknown as number, pending: false })) as typeof ownedLists;
	}

	const allLists = [
		...ownedLists.map(l => ({ ...l, isOwner: true, ownerUsername: null, pending: false })),
		...acceptedShared
	].sort((a, b) => a.updatedAt - b.updatedAt);

	return json({ lists: allLists, pendingInvitations });
};

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { name, description, iconId } = await event.request.json();
	if (!name?.trim()) return json({ error: 'Name erforderlich' }, { status: 400 });

	const id = generateId();
	const ts = now();
	const safeIconId = iconId ?? null;
	db.insert(lists).values({ id, name: name.trim(), description: description?.trim() ?? null, iconId: safeIconId, ownerId: user!.id, createdAt: ts, updatedAt: ts }).run();

	return json({ id, name, description, iconId: safeIconId, ownerId: user!.id, openCount: 0, createdAt: ts, updatedAt: ts, isOwner: true, ownerUsername: null }, { status: 201 });
};

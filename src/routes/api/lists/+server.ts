
import type { RequestHandler } from './$types';
import { authGuard } from '#lib/auth/middleware';
import { db } from '#lib/db';
import { lists, items, listMembers, users } from '#lib/db/schema';
import { eq, count, sql, and } from 'drizzle-orm';
import { now, generateId } from '#lib/auth';

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const kind = event.url.searchParams.get('kind');
	const itemCounts = db
		.select({
			listId: items.listId,
			total: count(items.id).as('total'),
			open: sql<number>`sum(case when ${items.isChecked} = 0 then 1 else 0 end)`.as('open')
		})
		.from(items)
		.groupBy(items.listId)
		.as('item_counts');

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
			iconId: lists.iconId, kind: lists.kind, checklistSections: lists.checklistSections, defaultSectionId: lists.defaultSectionId,
			ownerId: lists.ownerId,
			ownerUsername: sql<string>`NULL`,
			locationLat: lists.locationLat,
			locationLng: lists.locationLng,
			locationName: lists.locationName,
			createdAt: lists.createdAt,
			updatedAt: lists.updatedAt,
			openCount: sql<number>`COALESCE(${itemCounts.open}, 0)`,
			totalCount: sql<number>`COALESCE(${itemCounts.total}, 0)`,
			memberCount: sql<number>`COALESCE(${memberCounts.cnt}, 0)`,
			isOwner: sql<number>`1`
		})
		.from(lists)
		.leftJoin(itemCounts, eq(lists.id, itemCounts.listId))
		.leftJoin(memberCounts, eq(lists.id, memberCounts.listId))
		.where(and(eq(lists.ownerId, user!.id), kind === 'shopping' ? eq(lists.kind, 'shopping') : undefined))
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
				iconId: lists.iconId, kind: lists.kind, checklistSections: lists.checklistSections, defaultSectionId: lists.defaultSectionId,
				ownerId: lists.ownerId,
				ownerUsername: users.username,
				locationLat: lists.locationLat,
				locationLng: lists.locationLng,
				locationName: lists.locationName,
				createdAt: lists.createdAt,
				updatedAt: lists.updatedAt,
				openCount: sql<number>`COALESCE(${itemCounts.open}, 0)`,
				totalCount: sql<number>`COALESCE(${itemCounts.total}, 0)`,
				memberCount: sql<number>`0`,
				isOwner: sql<number>`0`,
				memberStatus: listMembers.status,
				userPermission: listMembers.permission
			})
			.from(listMembers)
			.innerJoin(lists, eq(listMembers.listId, lists.id))
			.innerJoin(users, eq(lists.ownerId, users.id))
			.leftJoin(itemCounts, eq(lists.id, itemCounts.listId))
			.where(and(eq(listMembers.userId, user!.id), kind === 'shopping' ? eq(lists.kind, 'shopping') : undefined))
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
				iconId: lists.iconId, kind: lists.kind, checklistSections: lists.checklistSections, defaultSectionId: lists.defaultSectionId, ownerId: lists.ownerId, ownerUsername: users.username,
				locationLat: lists.locationLat, locationLng: lists.locationLng, locationName: lists.locationName,
				createdAt: lists.createdAt, updatedAt: lists.updatedAt,
				openCount: sql<number>`COALESCE(${itemCounts.open}, 0)`,
				totalCount: sql<number>`COALESCE(${itemCounts.total}, 0)`,
				memberCount: sql<number>`0`, isOwner: sql<number>`0`
			})
			.from(listMembers)
			.innerJoin(lists, eq(listMembers.listId, lists.id))
			.innerJoin(users, eq(lists.ownerId, users.id))
			.leftJoin(itemCounts, eq(lists.id, itemCounts.listId))
			.where(and(eq(listMembers.userId, user!.id), kind === 'shopping' ? eq(lists.kind, 'shopping') : undefined))
			.all();
		acceptedShared = fallback.map(l => ({ ...l, isOwner: false as unknown as number, pending: false })) as typeof ownedLists;
	}

	const allLists = [
		...ownedLists.map(l => ({ ...l, isOwner: true, userPermission: 'owner' as const, ownerUsername: null, pending: false })),
		...acceptedShared
	].sort((a, b) => a.updatedAt - b.updatedAt);

	return Response.json({ lists: allLists, pendingInvitations });
};

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { name, description, iconId, kind = 'shopping', locationLat = null, locationLng = null, locationName = null } = await event.request.json();
	if (typeof name !== 'string' || !name.trim()) return Response.json({ error: 'Name erforderlich' }, { status: 400 });

	if (kind !== 'shopping' && kind !== 'checklist') return Response.json({ error: 'Invalid list type' }, { status: 400 });
	const id = generateId(16);
	const ts = now();
	const safeIconId = iconId ?? null;
	db.insert(lists).values({ id, name: name.trim(), description: description?.trim() ?? null, iconId: safeIconId, kind, locationLat, locationLng, locationName, ownerId: user!.id, createdAt: ts, updatedAt: ts }).run();

	return Response.json({ id, name, description, iconId: safeIconId, kind, locationLat, locationLng, locationName, ownerId: user!.id, openCount: 0, totalCount: 0, createdAt: ts, updatedAt: ts, isOwner: true, ownerUsername: null }, { status: 201 });
};

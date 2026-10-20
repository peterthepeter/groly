import * as m from '#lib/paraglide/messages';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '#lib/db';
import { users as usersTable } from '#lib/db/schema';
import { asc } from 'drizzle-orm';
import { listAdminUsers } from '#lib/server/adminUsers';
import { getOpenInviteFor } from '#lib/auth/invites';

export const load: PageServerLoad = ({ locals, params, url, setHeaders }) => {
	if (locals.user?.role !== 'admin') redirect(302, '/einstellungen');
	const users = listAdminUsers();
	const member = users.find(user => user.id === params.id);
	if (!member) error(404, m.admin_user_not_found());
	const bootstrapId = db.select({ id: usersTable.id }).from(usersTable).orderBy(asc(usersTable.createdAt)).limit(1).get()?.id;
	const isBootstrap = member.id === bootstrapId;
	const canManage = member.id !== locals.user.id && !isBootstrap
		&& (member.role !== 'admin' || users.filter(user => user.role === 'admin').length > 1);
	setHeaders({ 'Cache-Control': 'no-store' });
	const openInvite = isBootstrap ? null : getOpenInviteFor(member.id);
	const invite = openInvite?.token ? {
		userId: member.id,
		inviteUrl: `${url.origin}/invite/${openInvite.token}`,
		type: openInvite.type,
		expiresAt: openInvite.expiresAt
	} : null;
	return { member, isBootstrap, canChangeRole: canManage, canDelete: canManage, invite, legacyInvite: !!openInvite && !openInvite.expired && !openInvite.token };
};

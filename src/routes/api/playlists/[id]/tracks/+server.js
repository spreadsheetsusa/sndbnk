import { error, json } from '@sveltejs/kit';

import {
	addTrackToPlaylist,
	removeTrackFromPlaylist,
	reorderPlaylistTracks
} from '#lib/server/playlists';
import { isTrustedMutationRequest } from '#lib/server/request-origin';

export async function POST({ locals, params, request, url }) {
	if (!locals.user) error(401, 'Sign in to edit playlists.');
	if (!isTrustedMutationRequest(request, url)) {
		error(403, 'Invalid request origin.');
	}

	const body = await request.json().catch(() => null);
	const trackId = typeof body?.trackId === 'string' ? body.trackId : '';
	if (!trackId) error(400, 'trackId is required.');

	const result = await addTrackToPlaylist(locals.user.id, params.id, trackId);
	if (!result.ok) error(400, result.message);

	return json({ ok: true });
}

export async function DELETE({ locals, params, request, url }) {
	if (!locals.user) error(401, 'Sign in to edit playlists.');
	if (!isTrustedMutationRequest(request, url)) {
		error(403, 'Invalid request origin.');
	}

	const body = await request.json().catch(() => null);
	const trackId = typeof body?.trackId === 'string' ? body.trackId : '';
	if (!trackId) error(400, 'trackId is required.');

	const result = await removeTrackFromPlaylist(locals.user.id, params.id, trackId);
	if (!result.ok) error(404, result.message);

	return json({ ok: true });
}

export async function PATCH({ locals, params, request, url }) {
	if (!locals.user) error(401, 'Sign in to edit playlists.');
	if (!isTrustedMutationRequest(request, url)) {
		error(403, 'Invalid request origin.');
	}

	const body = await request.json().catch(() => null);
	const trackIds = Array.isArray(body?.trackIds) ? body.trackIds : null;
	if (!trackIds || trackIds.some((id) => typeof id !== 'string')) {
		error(400, 'trackIds must be an array of strings.');
	}

	const result = await reorderPlaylistTracks(locals.user.id, params.id, trackIds);
	if (!result.ok) error(400, result.message);

	return json({ ok: true });
}

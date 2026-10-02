import { apiRequest, isApiConfigured, requestJson } from './apiClient.js';

export async function loadAdminWorkspace() {
  const workspace = await apiRequest('/api/admin/bootstrap');
  if (!workspace?.currentUser || !Array.isArray(workspace.permissions)) {
    throw new Error('The admin bootstrap response must include currentUser and permissions.');
  }
  return {
    currentUser: workspace.currentUser,
    permissions: workspace.permissions,
    posts: Array.isArray(workspace.posts) ? workspace.posts : [],
    users: Array.isArray(workspace.users) ? workspace.users : [],
    roles: Array.isArray(workspace.roles) ? workspace.roles : [],
    logs: Array.isArray(workspace.logs) ? workspace.logs : [],
  };
}

export function createPost(post) {
  return apiRequest('/api/admin/posts', requestJson('POST', post));
}

export function updatePost(slug, post) {
  return apiRequest(`/api/admin/posts/${encodeURIComponent(slug)}`, requestJson('PUT', post));
}

export function updatePostStatus(slug, status) {
  return apiRequest(`/api/admin/posts/${encodeURIComponent(slug)}/status`, requestJson('PATCH', {
    status,
    ...(status === 'draft' ? { featured: false } : {}),
  }));
}

export function deletePost(slug) {
  return apiRequest(`/api/admin/posts/${encodeURIComponent(slug)}`, { method: 'DELETE' });
}

export function inviteUser(user) {
  return apiRequest('/api/admin/users/invitations', requestJson('POST', user));
}

export function updateUser(userId, changes) {
  return apiRequest(`/api/admin/users/${encodeURIComponent(userId)}`, requestJson('PATCH', changes));
}

export function removeUser(userId) {
  return apiRequest(`/api/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
}

export function createRole(role) {
  return apiRequest('/api/admin/roles', requestJson('POST', role));
}

export function updateRole(roleId, changes) {
  return apiRequest(`/api/admin/roles/${encodeURIComponent(roleId)}`, requestJson('PATCH', changes));
}

export function deleteRole(roleId) {
  return apiRequest(`/api/admin/roles/${encodeURIComponent(roleId)}`, { method: 'DELETE' });
}

export function clearActivity() {
  return apiRequest('/api/admin/activity', { method: 'DELETE' });
}

export function loadPublicPosts() {
  if (isApiConfigured) return apiRequest('/api/posts');
  return Promise.resolve(null);
}

export function signIn(email, password) {
  return apiRequest('/api/auth/login', requestJson('POST', { email, password }));
}

export function signOut() {
  return apiRequest('/api/auth/logout', { method: 'POST' });
}
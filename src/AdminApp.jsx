import { useEffect, useMemo, useState } from 'react';
import './admin.css';
import { isApiConfigured } from './data/apiClient.js';
import { clearActivity, createPost as createPostRequest, createRole as createRoleRequest, deletePost as deletePostRequest, deleteRole as deleteRoleRequest, inviteUser as inviteUserRequest, loadAdminWorkspace, signIn, signOut, updatePost as updatePostRequest, updatePostStatus as updatePostStatusRequest, updateRole as updateRoleRequest, updateUser as updateUserRequest } from './data/adminApi.js';
import { permissionCatalog, readAdminData, readPosts, writeAdminData, writePosts } from './data/blogStore.js';

const blankPost = { title: '', category: 'Creative work', type: 'Essay', readTime: '5 min read', description: '', author: '', image: '', alt: '', status: 'draft', featured: false, content: [''] };
const navigation = [
    { id: 'overview', label: 'Overview', permission: 'posts.view' },
    { id: 'posts', label: 'Posts', permission: 'posts.view' },
    { id: 'users', label: 'Users & admins', permission: 'users.view' },
    { id: 'roles', label: 'Roles & permissions', permission: 'roles.manage' },
    { id: 'logs', label: 'Activity log', permission: 'logs.view' },
];

const makeId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const slugify = (value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function AdminApp() {
    const [posts, setPosts] = useState(() => isApiConfigured ? [] : readPosts());
    const [data, setData] = useState(readAdminData);
    const [serverSession, setServerSession] = useState(null);
    const [apiLoading, setApiLoading] = useState(isApiConfigured);
    const [apiError, setApiError] = useState('');
    const [apiErrorStatus, setApiErrorStatus] = useState(0);
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginPending, setLoginPending] = useState(false);
    const [activeUserId, setActiveUserId] = useState(() => localStorage.getItem('field-notes.role-preview') || 'user-owner');
    const [section, setSection] = useState('overview');
    const [postSearch, setPostSearch] = useState('');
    const [logSearch, setLogSearch] = useState('');
    const [userSearch, setUserSearch] = useState('');
    const [userView, setUserView] = useState('members');
    const [postForm, setPostForm] = useState(null);
    const [editingPost, setEditingPost] = useState(null);
    const [newRole, setNewRole] = useState({ name: '', description: '' });
    const [rolePermissionDrafts, setRolePermissionDrafts] = useState({});
    const [savingRoleId, setSavingRoleId] = useState(null);
    const [savingAllPermissions, setSavingAllPermissions] = useState(false);
    const [notice, setNotice] = useState('');

    const activeUser = isApiConfigured ? serverSession?.currentUser : data.users.find((user) => user.id === activeUserId) || data.users[0];
    const activeRole = data.roles.find((role) => role.id === activeUser?.roleId);
    const permissions = isApiConfigured ? serverSession?.permissions || [] : activeRole?.permissions || [];
    const hasPermission = (permission) => permissions.includes(permission);
    const allowedSection = navigation.find((item) => hasPermission(item.permission))?.id || 'restricted';
    const sectionAllowed = navigation.some((item) => item.id === section && hasPermission(item.permission));

    useEffect(() => {
        if (!sectionAllowed) setSection(allowedSection);
    }, [activeRole?.id, activeRole?.permissions, allowedSection, sectionAllowed]);

    const refreshWorkspace = async () => {
        if (!isApiConfigured) return;
        const workspace = await loadAdminWorkspace();
        setServerSession({ currentUser: workspace.currentUser, permissions: workspace.permissions });
        setPosts(workspace.posts);
        setData({ users: workspace.users, roles: workspace.roles, logs: workspace.logs });
        setApiError('');
        setApiErrorStatus(0);
    };

    useEffect(() => {
        if (!isApiConfigured) return;
        refreshWorkspace().catch((error) => {
            setApiError(error.message);
            setApiErrorStatus(error.status || 0);
        }).finally(() => setApiLoading(false));
    }, []);

    const recentLogs = useMemo(() => [...data.logs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [data.logs]);
    const visiblePosts = posts.filter((post) => `${post.title} ${post.category} ${post.author} ${post.status}`.toLowerCase().includes(postSearch.toLowerCase()));
    const visibleUsers = data.users.filter((user) => {
        const isAdmin = data.roles.find((role) => role.id === user.roleId)?.permissions.includes('admins.manage');
        return (userView === 'admins' ? isAdmin : !isAdmin) && `${user.name} ${user.email}`.toLowerCase().includes(userSearch.toLowerCase());
    });
    const visibleLogs = recentLogs.filter((log) => `${log.actor} ${log.action} ${log.target}`.toLowerCase().includes(logSearch.toLowerCase()));

    const persistAdmin = (next) => {
        setData(next);
        if (!isApiConfigured) writeAdminData(next);
    };

    const addLog = (action, target) => {
        if (isApiConfigured) return;
        const event = { id: makeId(), actor: activeUser?.name || 'Workspace', action, target, createdAt: new Date().toISOString() };
        const current = readAdminData();
        const next = { ...current, logs: [...current.logs, event].slice(-500) };
        persistAdmin(next);
    };

    const savePostList = (next) => {
        setPosts(next);
        if (!isApiConfigured) writePosts(next);
    };

    const openPostEditor = (post = null) => {
        setEditingPost(post?.slug || null);
        setPostForm(post ? { ...post, content: Array.isArray(post.content) ? post.content : [''] } : { ...blankPost, author: activeUser?.name || '' });
    };

    const savePost = async (event) => {
        event.preventDefault();
        let slug = editingPost || slugify(postForm.title);
        if (!slug) return;
        if (!editingPost && posts.some((post) => post.slug === slug)) slug = `${slug}-${Date.now().toString(36)}`;
        const existing = editingPost ? posts.find((post) => post.slug === editingPost) : null;
        const status = hasPermission('posts.publish') ? postForm.status : (existing?.status || 'draft');
        const saved = { ...postForm, slug, status, featured: status === 'published' && Boolean(postForm.featured), content: postForm.content.map((line) => line.trim()).filter(Boolean) };
        if (isApiConfigured) {
            try {
                if (editingPost) await updatePostRequest(editingPost, saved);
                else await createPostRequest(saved);
                await refreshWorkspace();
                setPostForm(null);
                setNotice(existing ? 'Post changes saved.' : 'Post created.');
            } catch (error) {
                setNotice(`Could not save post: ${error.message}`);
            }
            return;
        }
        const next = existing
            ? posts.map((post) => post.slug === editingPost ? saved : (saved.featured && post.featured ? { ...post, featured: false } : post))
            : [saved, ...posts.map((post) => saved.featured && post.featured ? { ...post, featured: false } : post)];
        savePostList(next);
        addLog(existing ? 'Updated post' : 'Created post', saved.title);
        setPostForm(null);
        setNotice(existing ? 'Post changes saved.' : 'Post created.');
    };

    const changePostStatus = async (post, status) => {
        if (status === 'published' && !hasPermission('posts.publish')) return;
        if (isApiConfigured) {
            try {
                await updatePostStatusRequest(post.slug, status);
                await refreshWorkspace();
                setNotice(status === 'published' ? 'Post published.' : 'Post saved as draft.');
            } catch (error) {
                setNotice(`Could not update post: ${error.message}`);
            }
            return;
        }
        savePostList(posts.map((item) => item.slug === post.slug ? { ...item, status, featured: status === 'draft' ? false : item.featured } : item));
        addLog(status === 'published' ? 'Published post' : 'Moved post to drafts', post.title);
        setNotice(status === 'published' ? 'Post published.' : 'Post saved as draft.');
    };

    const deletePost = async (post) => {
        if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) return;
        if (isApiConfigured) {
            try {
                await deletePostRequest(post.slug);
                await refreshWorkspace();
                setNotice('Post deleted.');
            } catch (error) {
                setNotice(`Could not delete post: ${error.message}`);
            }
            return;
        }
        savePostList(posts.filter((item) => item.slug !== post.slug));
        addLog('Deleted post', post.title);
        setNotice('Post deleted.');
    };

    const updateUser = async (user, patch) => {
        const assignedRole = data.roles.find((role) => role.id === (patch.roleId || user.roleId));
        if (assignedRole?.permissions.includes('admins.manage') && !hasPermission('admins.manage')) {
            setNotice('Only an admin manager can assign admin access.');
            return;
        }
        if (isApiConfigured) {
            try {
                await updateUserRequest(user.id, patch);
                await refreshWorkspace();
                setNotice('User updated.');
            } catch (error) {
                setNotice(`Could not update user: ${error.message}`);
            }
            return;
        }
        persistAdmin({ ...data, users: data.users.map((item) => item.id === user.id ? { ...item, ...patch } : item) });
        addLog(patch.roleId ? 'Changed user role' : patch.status ? `Set user ${patch.status}` : 'Updated user', user.email);
        setNotice('User updated.');
    };

    const inviteUser = async () => {
        const name = window.prompt('Name for the invited user');
        if (!name?.trim()) return;
        const email = window.prompt('Email address for the invited user');
        if (!email?.trim()) return;
        const user = { id: makeId(), name: name.trim(), email: email.trim(), roleId: 'reader', status: 'invited', joinedAt: new Date().toISOString().slice(0, 10) };
        if (isApiConfigured) {
            try {
                await inviteUserRequest({ name: user.name, email: user.email });
                await refreshWorkspace();
                setNotice('Invitation sent.');
            } catch (error) {
                setNotice(`Could not invite user: ${error.message}`);
            }
            return;
        }
        persistAdmin({ ...data, users: [...data.users, user] });
        addLog('Invited user', user.email);
        setNotice('Invitation added to the local workspace.');
    };

    const addRole = async (event) => {
        event.preventDefault();
        const id = slugify(newRole.name);
        if (!id || data.roles.some((role) => role.id === id)) return;
        const role = { id, name: newRole.name.trim(), description: newRole.description.trim(), permissions: [], locked: false };
        if (isApiConfigured) {
            try {
                await createRoleRequest(role);
                await refreshWorkspace();
                setNewRole({ name: '', description: '' });
                setNotice('Role created with no permissions.');
            } catch (error) {
                setNotice(`Could not create role: ${error.message}`);
            }
            return;
        }
        persistAdmin({ ...data, roles: [...data.roles, role] });
        addLog('Created role', role.name);
        setNewRole({ name: '', description: '' });
        setNotice('Role created with no permissions.');
    };

    const rolePermissionsChanged = (role) => {
        const draft = rolePermissionDrafts[role.id];
        return Boolean(draft && (draft.length !== role.permissions.length || draft.some((permission) => !role.permissions.includes(permission))));
    };
    const dirtyRoles = data.roles.filter(rolePermissionsChanged);

    const togglePermission = (role, permissionId) => {
        if (role.locked || (permissionId === 'admins.manage' && !hasPermission('admins.manage'))) return;
        const currentPermissions = rolePermissionDrafts[role.id] || role.permissions;
        const nextPermissions = currentPermissions.includes(permissionId) ? currentPermissions.filter((item) => item !== permissionId) : [...currentPermissions, permissionId];
        setRolePermissionDrafts((current) => ({ ...current, [role.id]: nextPermissions }));
    };

    const discardRolePermissions = (roleId) => {
        setRolePermissionDrafts((current) => {
            const next = { ...current };
            delete next[roleId];
            return next;
        });
    };

    const saveRolePermissions = async (role) => {
        const nextPermissions = rolePermissionDrafts[role.id];
        if (!nextPermissions || !rolePermissionsChanged(role) || role.locked) return;
        setSavingRoleId(role.id);
        if (isApiConfigured) {
            try {
                await updateRoleRequest(role.id, { permissions: nextPermissions });
                await refreshWorkspace();
                discardRolePermissions(role.id);
                setNotice('Role permissions saved.');
            } catch (error) {
                setNotice(`Could not update permissions: ${error.message}`);
            } finally {
                setSavingRoleId(null);
            }
            return;
        }
        const nextRoles = data.roles.map((item) => item.id === role.id ? { ...item, permissions: nextPermissions } : item);
        persistAdmin({ ...data, roles: nextRoles });
        addLog('Changed role permissions', role.name);
        discardRolePermissions(role.id);
        setSavingRoleId(null);
        setNotice('Role permissions saved.');
    };

    const saveAllRolePermissions = async () => {
        if (!dirtyRoles.length || savingAllPermissions) return;
        setSavingAllPermissions(true);
        if (isApiConfigured) {
            try {
                for (const role of dirtyRoles) {
                    await updateRoleRequest(role.id, { permissions: rolePermissionDrafts[role.id] });
                }
                await refreshWorkspace();
                setRolePermissionDrafts({});
                setNotice('All role permissions updated.');
            } catch (error) {
                setNotice(`Could not update all permissions: ${error.message}`);
            } finally {
                setSavingAllPermissions(false);
            }
            return;
        }

        const changedRoleIds = dirtyRoles.map((role) => role.id);
        const nextData = {
            ...data,
            roles: data.roles.map((role) => changedRoleIds.includes(role.id)
                ? { ...role, permissions: rolePermissionDrafts[role.id] }
                : role),
        };
        persistAdmin(nextData);
        dirtyRoles.forEach((role) => addLog('Changed role permissions', role.name));
        setRolePermissionDrafts({});
        setSavingAllPermissions(false);
        setNotice('All role permissions updated.');
    };

    const discardAllRolePermissions = () => setRolePermissionDrafts({});

    const deleteRole = async (role) => {
        if (role.locked || data.users.some((user) => user.roleId === role.id)) return;
        if (!window.confirm(`Delete the ${role.name} role?`)) return;
        if (isApiConfigured) {
            try {
                await deleteRoleRequest(role.id);
                await refreshWorkspace();
                setNotice('Role deleted.');
            } catch (error) {
                setNotice(`Could not delete role: ${error.message}`);
            }
            return;
        }
        persistAdmin({ ...data, roles: data.roles.filter((item) => item.id !== role.id) });
        addLog('Deleted role', role.name);
    };

    const exportLogs = () => {
        const blob = new Blob([JSON.stringify(recentLogs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'field-notes-activity-log.json';
        link.click();
        URL.revokeObjectURL(url);
    };

    const clearLogs = async () => {
        if (!window.confirm(`Clear the ${isApiConfigured ? 'workspace' : 'local'} activity log? This cannot be undone.`)) return;
        if (isApiConfigured) {
            try {
                await clearActivity();
                await refreshWorkspace();
                setNotice('Activity log cleared.');
            } catch (error) {
                setNotice(`Could not clear activity: ${error.message}`);
            }
            return;
        }
        persistAdmin({ ...data, logs: [] });
        setNotice('Activity log cleared.');
    };

    const submitLogin = async (event) => {
        event.preventDefault();
        setLoginPending(true);
        try {
            await signIn(loginEmail, loginPassword);
            await refreshWorkspace();
            setLoginPassword('');
        } catch (error) {
            setApiError(error.message);
            setApiErrorStatus(error.status || 0);
        } finally {
            setLoginPending(false);
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut();
            setServerSession(null);
            setApiError('Sign in to access the editorial workspace.');
            setApiErrorStatus(401);
        } catch (error) {
            setNotice(`Could not sign out: ${error.message}`);
        }
    };

    const goTo = (id) => {
        if (navigation.find((item) => item.id === id && hasPermission(item.permission))) setSection(id);
    };

    return <div className="admin-shell">
        <aside className="admin-sidebar">
            <a className="admin-brand" href="./index.html"><span className="admin-brand-mark">F</span><span>FIELD NOTES<small>EDITORIAL DESK</small></span></a>
            <p className="sidebar-label">WORKSPACE</p>
            <nav className="admin-nav" aria-label="Admin navigation">{navigation.filter((item) => hasPermission(item.permission)).map((item) => <button key={item.id} className={section === item.id ? 'is-active' : ''} onClick={() => goTo(item.id)}><span className={`nav-glyph glyph-${item.id}`} aria-hidden="true" />{item.label}</button>)}</nav>
            <a className="public-site-link" href="./index.html">← View public site</a>
            <div className="sidebar-user"><span className="user-avatar">{activeUser?.name.split(' ').map((part) => part[0]).join('')}</span><span>{activeUser?.name}<small>{activeRole?.name || 'No role'}</small></span><span className="online-dot" /></div>
        </aside>

        <main className="admin-main">
            <header className="admin-topbar"><div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>{navigation.find((item) => item.id === section)?.label || 'Overview'}</strong></div><div className="topbar-tools">{isApiConfigured ? <><span className="signed-in-label">{activeUser ? `Signed in as ${activeUser.name}` : 'Backend session'}</span>{serverSession && <button className="sign-out-action" onClick={handleSignOut}>Sign out</button>}</> : <label className="role-preview">Preview role<select aria-label="Preview access as user" value={activeUserId} onChange={(event) => { setActiveUserId(event.target.value); localStorage.setItem('field-notes.role-preview', event.target.value); }}><option value="">No user</option>{data.users.map((user) => <option value={user.id} key={user.id}>{user.name} · {data.roles.find((role) => role.id === user.roleId)?.name}</option>)}</select></label>}{activeUser && <span className="admin-avatar">{activeUser.name.split(' ').map((part) => part[0]).join('')}</span>}</div></header>

            <div className="local-warning"><span aria-hidden="true">!</span><p>{isApiConfigured ? <><strong>Backend mode</strong> This portal uses the configured API; the server must authenticate sessions and authorize every admin operation.</> : <><strong>Local demo workspace</strong> Data is stored in this browser only. Role controls are for preview; there is no server authentication or shared database.</>}</p></div>
            {notice && <div className="admin-notice" role="status">{notice}<button aria-label="Dismiss message" onClick={() => setNotice('')}>×</button></div>}
            {apiLoading && <div className="api-loading">Loading admin workspace…</div>}
            {apiError && <div className="api-error" role="alert">{apiError}{apiErrorStatus === 401 && <form className="login-form" onSubmit={submitLogin}><label>Email<input type="email" autoComplete="username" required value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} /></label><label>Password<input type="password" autoComplete="current-password" required value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} /></label><button type="submit" disabled={loginPending}>{loginPending ? 'Signing in…' : 'Sign in'}</button></form>}{apiErrorStatus !== 401 && <button onClick={() => { setApiLoading(true); refreshWorkspace().catch((error) => { setApiError(error.message); setApiErrorStatus(error.status || 0); }).finally(() => setApiLoading(false)); }}>Retry connection</button>}</div>}

            {(!isApiConfigured || serverSession) && <>
                {section === 'overview' && hasPermission('posts.view') && <section className="admin-content"><div className="page-title-row"><div><p className="admin-eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()}</p><h1>Editorial overview</h1><p className="page-subtitle">A clear view of your publication, people, and recent activity.</p></div>{hasPermission('posts.create') && <button className="primary-action" onClick={() => openPostEditor()}>＋ <span>New post</span></button>}</div>
                    <div className="stat-grid"><div className="stat-block"><span>Total posts</span><strong>{posts.length}</strong><small>{posts.filter((post) => post.status === 'published').length} published · {posts.filter((post) => post.status === 'draft').length} drafts</small></div><div className="stat-block"><span>Workspace users</span><strong>{data.users.length}</strong><small>{data.users.filter((user) => user.status === 'active').length} active members</small></div><div className="stat-block"><span>Admin roles</span><strong>{data.roles.filter((role) => role.permissions.includes('admins.manage')).length}</strong><small>{data.roles.length} roles configured</small></div><div className="stat-block"><span>Activity events</span><strong>{data.logs.length}</strong><small>Latest changes in this browser</small></div></div>
                    <div className="overview-grid"><section className="panel"><div className="panel-heading"><div><p className="admin-eyebrow">CONTENT</p><h2>Recent posts</h2></div><button className="quiet-action" onClick={() => goTo('posts')}>All posts →</button></div><div className="compact-list">{posts.slice(0, 4).map((post) => <div className="compact-row" key={post.slug}><span className="mini-thumb" style={{ backgroundImage: `url(${post.image})` }} /><span className="compact-title">{post.title}<small>{post.category}</small></span><span className={`status-tag status-${post.status}`}>{post.status}</span></div>)}</div></section>
                        <section className="panel"><div className="panel-heading"><div><p className="admin-eyebrow">WORKSPACE</p><h2>Latest activity</h2></div><button className="quiet-action" onClick={() => goTo('logs')}>View log →</button></div>{recentLogs.length ? <div className="activity-list">{recentLogs.slice(0, 5).map((log) => <div className="activity-row" key={log.id}><span className="activity-dot" /><p><strong>{log.actor}</strong> {log.action.toLowerCase()} <b>{log.target}</b><small>{new Date(log.createdAt).toLocaleString()}</small></p></div>)}</div> : <div className="empty-panel">Your changes will appear here as you work.</div>}</section></div>
                </section>}

                {section === 'posts' && <section className="admin-content"><div className="page-title-row"><div><p className="admin-eyebrow">PUBLICATION</p><h1>Posts</h1><p className="page-subtitle">Write, revise, and publish your stories.</p></div>{hasPermission('posts.create') && <button className="primary-action" onClick={() => openPostEditor()}>＋ <span>New post</span></button>}</div><section className="panel table-panel"><div className="table-toolbar"><label className="admin-search"><span aria-hidden="true">⌕</span><input value={postSearch} onChange={(event) => setPostSearch(event.target.value)} placeholder="Search posts" /></label><span className="result-count">{visiblePosts.length} posts</span></div><div className="table-scroll"><table><thead><tr><th>POST</th><th>AUTHOR</th><th>TOPIC</th><th>STATUS</th><th>UPDATED</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visiblePosts.map((post) => <tr key={post.slug}><td><div className="post-cell"><span className="table-thumb" style={{ backgroundImage: `url(${post.image})` }} /><span><strong>{post.title}</strong><small>{post.type} · {post.readTime}</small></span></div></td><td>{post.author}</td><td>{post.category}</td><td><span className={`status-tag status-${post.status}`}>{post.status}</span></td><td>Oct 02, 2026</td><td><div className="row-actions">{hasPermission('posts.edit') && <button title="Edit post" aria-label={`Edit ${post.title}`} onClick={() => openPostEditor(post)}>Edit</button>}{hasPermission('posts.publish') && <button title={post.status === 'published' ? 'Move to drafts' : 'Publish'} aria-label={post.status === 'published' ? `Move ${post.title} to drafts` : `Publish ${post.title}`} onClick={() => changePostStatus(post, post.status === 'published' ? 'draft' : 'published')}>{post.status === 'published' ? 'Unpublish' : 'Publish'}</button>}{hasPermission('posts.delete') && <button className="danger-text" title="Delete post" aria-label={`Delete ${post.title}`} onClick={() => deletePost(post)}>Delete</button>}</div></td></tr>)}</tbody></table>{visiblePosts.length === 0 && <div className="empty-panel">No posts match this search.</div>}</div></section></section>}

                {section === 'users' && <section className="admin-content"><div className="page-title-row"><div><p className="admin-eyebrow">PEOPLE & ACCESS</p><h1>Users & admins</h1><p className="page-subtitle">Manage workspace membership and role assignment.</p></div>{hasPermission('users.manage') && <button className="primary-action" onClick={inviteUser}>＋ <span>Invite user</span></button>}</div><div className="subnav-tabs"><button className={userView === 'members' ? 'is-active' : ''} onClick={() => setUserView('members')}>Members <span>{data.users.filter((user) => !data.roles.find((role) => role.id === user.roleId)?.permissions.includes('admins.manage')).length}</span></button><button className={userView === 'admins' ? 'is-active' : ''} onClick={() => setUserView('admins')}>Admins <span>{data.users.filter((user) => data.roles.find((role) => role.id === user.roleId)?.permissions.includes('admins.manage')).length}</span></button></div><section className="panel table-panel"><div className="table-toolbar"><label className="admin-search"><span aria-hidden="true">⌕</span><input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search people" /></label><span className="result-count">{visibleUsers.length} people</span></div><div className="table-scroll"><table><thead><tr><th>PERSON</th><th>ROLE</th><th>STATUS</th><th>JOINED</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visibleUsers.map((user) => { const role = data.roles.find((item) => item.id === user.roleId); const isAdmin = role?.permissions.includes('admins.manage'); return <tr key={user.id}><td><div className="person-cell"><span className="user-avatar">{user.name.split(' ').map((part) => part[0]).join('')}</span><span><strong>{user.name}</strong><small>{user.email}</small></span></div></td><td>{hasPermission('users.manage') ? <select className="table-select" aria-label={`Role for ${user.name}`} value={user.roleId} onChange={(event) => updateUser(user, { roleId: event.target.value })}>{data.roles.filter((option) => hasPermission('admins.manage') || !option.permissions.includes('admins.manage')).map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select> : role?.name}</td><td><span className={`status-tag status-${user.status}`}>{user.status}</span></td><td>{new Date(`${user.joinedAt}T00:00:00`).toLocaleDateString()}</td><td><div className="row-actions">{hasPermission(isAdmin ? 'admins.manage' : 'users.manage') && user.id !== activeUserId && <button onClick={() => updateUser(user, { status: user.status === 'active' ? 'suspended' : 'active' })}>{user.status === 'active' ? 'Suspend' : 'Activate'}</button>}</div></td></tr>; })}</tbody></table>{visibleUsers.length === 0 && <div className="empty-panel">No people match this search.</div>}</div></section><p className="supporting-note">Invitations and membership changes are stored locally; email delivery and account authentication require a connected backend.</p></section>}

                {section === 'roles' && <section className="admin-content"><div className="page-title-row"><div><p className="admin-eyebrow">ACCESS CONTROL</p><h1>Roles & permissions</h1><p className="page-subtitle">{dirtyRoles.length ? `${dirtyRoles.length} role${dirtyRoles.length === 1 ? '' : 's'} changed. Update to apply.` : 'Select permissions, then update to apply changes.'}</p></div><button className="primary-action role-header-update" type="button" disabled={!dirtyRoles.length || savingAllPermissions} onClick={saveAllRolePermissions}>{savingAllPermissions ? 'Updating…' : 'Update permissions'}</button></div><div className="role-layout"><section className="panel role-create"><p className="admin-eyebrow">NEW ROLE</p><h2>Create a role</h2><form onSubmit={addRole}><label>Role name<input required value={newRole.name} onChange={(event) => setNewRole({ ...newRole, name: event.target.value })} placeholder="e.g. Copy editor" /></label><label>Description<input value={newRole.description} onChange={(event) => setNewRole({ ...newRole, description: event.target.value })} placeholder="What this role is for" /></label><button className="primary-action" type="submit">＋ <span>Create role</span></button></form></section><div className="role-list">{data.roles.map((role) => <section className="panel role-panel" key={role.id}><div className="panel-heading"><div><h2>{role.name}{role.locked && <span className="locked-label">SYSTEM</span>}</h2><p>{role.description}</p></div>{!role.locked && !data.users.some((user) => user.roleId === role.id) && hasPermission('roles.manage') && <button className="danger-text" onClick={() => deleteRole(role)}>Delete role</button>}</div><div className="permission-grid">{permissionCatalog.map((permission) => <label className="permission-option" key={permission.id}><input type="checkbox" checked={(rolePermissionDrafts[role.id] ?? role.permissions).includes(permission.id)} disabled={role.locked || !hasPermission('roles.manage') || savingAllPermissions} onChange={() => togglePermission(role, permission.id)} /><span>{permission.label}<small>{permission.group}</small></span></label>)}</div></section>)}</div></div></section>}

                {section === 'logs' && <section className="admin-content"><div className="page-title-row"><div><p className="admin-eyebrow">WORKSPACE HISTORY</p><h1>Activity log</h1><p className="page-subtitle">A local record of changes made in this browser.</p></div><div className="title-actions"><button className="secondary-action" onClick={exportLogs}>↓ <span>Export JSON</span></button>{hasPermission('logs.manage') && <button className="secondary-action danger-outline" onClick={clearLogs}>Clear log</button>}</div></div><section className="panel table-panel"><div className="table-toolbar"><label className="admin-search"><span aria-hidden="true">⌕</span><input value={logSearch} onChange={(event) => setLogSearch(event.target.value)} placeholder="Search activity" /></label><span className="result-count">{visibleLogs.length} events</span></div><div className="table-scroll"><table><thead><tr><th>ACTIVITY</th><th>ACTOR</th><th>DETAIL</th><th>TIME</th></tr></thead><tbody>{visibleLogs.map((log) => <tr key={log.id}><td><span className="log-action">{log.action}</span></td><td>{log.actor}</td><td>{log.target}</td><td>{new Date(log.createdAt).toLocaleString()}</td></tr>)}</tbody></table>{visibleLogs.length === 0 && <div className="empty-panel">No activity recorded yet.</div>}</div></section><p className="supporting-note">This log is stored in local browser storage and can be cleared by users with the matching permission.</p></section>}

            </>}

        </main>

        {postForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPostForm(null); }}><section className="post-editor" role="dialog" aria-modal="true" aria-labelledby="editor-title"><header className="editor-header"><div><p className="admin-eyebrow">CONTENT EDITOR</p><h2 id="editor-title">{editingPost ? 'Edit post' : 'Create a post'}</h2></div><button className="icon-close" aria-label="Close editor" onClick={() => setPostForm(null)}>×</button></header><form onSubmit={savePost}><label>Title<input required value={postForm.title} onChange={(event) => setPostForm({ ...postForm, title: event.target.value })} placeholder="Give your story a title" /></label><div className="form-row"><label>Topic<select value={postForm.category} onChange={(event) => setPostForm({ ...postForm, category: event.target.value })}>{['Creative work', 'Slow living', 'Culture'].map((category) => <option key={category}>{category}</option>)}</select></label><label>Format<select value={postForm.type} onChange={(event) => setPostForm({ ...postForm, type: event.target.value })}>{['Essay', 'Field guide', 'Dispatch', 'Interview', 'Review'].map((type) => <option key={type}>{type}</option>)}</select></label></div><label>Summary<textarea required rows="2" value={postForm.description} onChange={(event) => setPostForm({ ...postForm, description: event.target.value })} placeholder="A short introduction" /></label><div className="form-row"><label>Author<input required value={postForm.author} onChange={(event) => setPostForm({ ...postForm, author: event.target.value })} /></label><label>Reading time<input value={postForm.readTime} onChange={(event) => setPostForm({ ...postForm, readTime: event.target.value })} /></label></div><label>Cover image URL<input type="url" value={postForm.image} onChange={(event) => setPostForm({ ...postForm, image: event.target.value })} placeholder="https://..." /></label><label>Image description<input value={postForm.alt} onChange={(event) => setPostForm({ ...postForm, alt: event.target.value })} placeholder="Describe the image for accessibility" /></label><label>Article text<textarea rows="5" value={postForm.content.join('\n\n')} onChange={(event) => setPostForm({ ...postForm, content: event.target.value.split(/\n\s*\n/) })} placeholder="Write paragraphs separated by a blank line" /></label>{hasPermission('posts.publish') && <label>Status<select value={postForm.status} onChange={(event) => setPostForm({ ...postForm, status: event.target.value, featured: event.target.value === 'draft' ? false : postForm.featured })}><option value="draft">Draft</option><option value="published">Published</option></select></label>}{hasPermission('posts.publish') && <label className="featured-post-toggle"><input type="checkbox" checked={Boolean(postForm.featured)} disabled={postForm.status !== 'published'} onChange={(event) => setPostForm({ ...postForm, featured: event.target.checked })} /><span>Feature on homepage<small>Only one published post is featured at a time.</small></span></label>}<footer className="editor-footer"><button type="button" className="secondary-action" onClick={() => setPostForm(null)}>Cancel</button><button type="submit" className="primary-action">Save post</button></footer></form></section></div>}
    </div>;
}

export default AdminApp;
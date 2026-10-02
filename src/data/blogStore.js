export const POST_STORAGE_KEY = 'field-notes.posts.v1';
export const ADMIN_STORAGE_KEY = 'field-notes.admin.v1';
export const STORE_UPDATED_EVENT = 'field-notes-store-updated';

export const initialPosts = [
  { slug: 'unfinished-work', category: 'Creative work', type: 'Essay', readTime: '8 min read', title: 'The case for unfinished work', description: 'What if the rough edges are where the real thinking begins?', author: 'Mira Sol', image: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=85', alt: 'Hand writing in a notebook', status: 'published', featured: true, content: ['We have a habit of treating finished work as the only work worth showing. The polished draft, the final frame, the version with all the seams tucked away. But the work before that version is where most of the learning happens.', 'An unfinished thing is still in conversation with its maker. It can change direction. It can ask a better question. Leaving room for that uncertainty is not a failure to commit; it is a way of paying attention.', 'Try sharing the sketch, keeping the question open, or returning tomorrow before deciding what the work means. Sometimes the rough edges are not waiting to be fixed. They are pointing somewhere.'] },
  { slug: 'slower-morning', category: 'Slow living', type: 'Field guide', readTime: '5 min read', title: 'A slower way to start the day', description: 'Small rituals for a morning that belongs to you.', author: 'Theo Park', image: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=900&q=85', alt: 'Coffee and notebook on a wooden desk', status: 'published', content: ['A morning does not need a perfect routine. It needs a little space before the day starts making its requests.', 'Put the phone somewhere you cannot reach from bed. Make something warm. Open a window, or a book, or the notebook you keep meaning to use. The point is not to optimize the first hour. It is to notice that it belongs to you.', 'Choose one small ritual and let it be enough. A day can begin quietly without being carefully engineered.'] },
  { slug: 'city-edges', category: 'Culture', type: 'Dispatch', readTime: '6 min read', title: 'Notes from the edges of the city', description: 'Looking for the places that refuse to be in a hurry.', author: 'Jules Martin', image: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=900&q=85', alt: 'City buildings in warm afternoon light', status: 'published', content: ['The city changes pace at its edges. The storefronts grow farther apart, the traffic loosens, and the walk starts to feel less like a route and more like a way to look.', 'I spent an afternoon following the side streets, stopping wherever someone had left a chair outside or a window open to the weather. These small invitations made the neighborhood feel less like a place to pass through.', 'There is no itinerary here. Just a reminder that a city is made of pauses as much as destinations.'] },
];

export const permissionCatalog = [
  { id: 'posts.view', label: 'View posts', group: 'Content' },
  { id: 'posts.create', label: 'Create posts', group: 'Content' },
  { id: 'posts.edit', label: 'Edit any post', group: 'Content' },
  { id: 'posts.delete', label: 'Delete posts', group: 'Content' },
  { id: 'posts.publish', label: 'Publish posts', group: 'Content' },
  { id: 'users.view', label: 'View users', group: 'People' },
  { id: 'users.manage', label: 'Manage users', group: 'People' },
  { id: 'admins.manage', label: 'Manage admins', group: 'People' },
  { id: 'roles.manage', label: 'Manage roles', group: 'Access' },
  { id: 'logs.view', label: 'View activity log', group: 'Access' },
  { id: 'logs.manage', label: 'Clear activity log', group: 'Access' },
];

const allPermissions = permissionCatalog.map(({ id }) => id);
const initialAdminData = {
  users: [
    { id: 'user-owner', name: 'Naeem Shar', email: 'naeemshar127@gmail.com', roleId: 'owner', status: 'active', joinedAt: '2026-02-12' },
    { id: 'user-editor', name: 'Mira Sol', email: 'mira@example.com', roleId: 'editor', status: 'active', joinedAt: '2026-03-08' },
    { id: 'user-author', name: 'Theo Park', email: 'theo@example.com', roleId: 'author', status: 'active', joinedAt: '2026-04-19' },
    { id: 'user-reader', name: 'Jules Martin', email: 'jules@example.com', roleId: 'reader', status: 'invited', joinedAt: '2026-06-02' },
  ],
  roles: [
    { id: 'owner', name: 'Owner', description: 'Full workspace access', permissions: allPermissions, locked: true },
    { id: 'editor', name: 'Editor', description: 'Create, edit, and publish content', permissions: ['posts.view', 'posts.create', 'posts.edit', 'posts.publish', 'logs.view'], locked: false },
    { id: 'author', name: 'Author', description: 'Create draft content', permissions: ['posts.view', 'posts.create'], locked: false },
    { id: 'moderator', name: 'Moderator', description: 'Manage members and review activity', permissions: ['posts.view', 'users.view', 'users.manage', 'logs.view', 'logs.manage'], locked: false },
    { id: 'reader', name: 'Reader', description: 'Read-only workspace access', permissions: ['posts.view', 'users.view'], locked: false },
  ],
  logs: [],
};

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function readPosts() {
  const stored = readJson(POST_STORAGE_KEY, null);
  if (Array.isArray(stored)) {
    const hasFeatureMetadata = stored.some((post) => typeof post.featured === 'boolean');
    const existingFeatureIndex = stored.findIndex((post) => post.featured === true);
    const featuredIndex = hasFeatureMetadata ? existingFeatureIndex : (stored.length ? 0 : -1);
    const normalized = stored.map((post, index) => ({ ...post, featured: index === featuredIndex }));
    if (normalized.some((post, index) => post.featured !== stored[index].featured)) {
      localStorage.setItem(POST_STORAGE_KEY, JSON.stringify(normalized));
    }
    return normalized;
  }
  localStorage.setItem(POST_STORAGE_KEY, JSON.stringify(initialPosts));
  return initialPosts;
}

export function writePosts(posts) {
  localStorage.setItem(POST_STORAGE_KEY, JSON.stringify(posts));
  window.dispatchEvent(new CustomEvent(STORE_UPDATED_EVENT));
}

export function readAdminData() {
  const stored = readJson(ADMIN_STORAGE_KEY, {});
  return {
    users: Array.isArray(stored.users) ? stored.users : initialAdminData.users,
    roles: Array.isArray(stored.roles) ? stored.roles : initialAdminData.roles,
    logs: Array.isArray(stored.logs) ? stored.logs : initialAdminData.logs,
  };
}

export function writeAdminData(data) {
  localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(data));
}

export function emitStoreUpdated() {
  window.dispatchEvent(new CustomEvent(STORE_UPDATED_EVENT));
}
import { useEffect, useState } from 'react';
import '../styles.css';
import { isApiConfigured } from './data/apiClient.js';
import { loadPublicPosts } from './data/adminApi.js';
import { readPosts, STORE_UPDATED_EVENT } from './data/blogStore.js';
const filters = ['all', 'Creative work', 'Slow living', 'Culture'];

function Wordmark() {
  return <a className="wordmark" href="#home" aria-label="Field Notes home"><span className="wordmark-mark">F</span><span>FIELD<br />NOTES</span></a>;
}

function ImageFrame({ src, alt, className = '' }) {
  return <div className={`image-frame ${className}`}><img src={src} alt={alt} /></div>;
}

function PostCard({ post, featured, saved, onSave }) {
  return <article className={`post-card ${featured ? 'post-card-featured' : ''}`}>
    <a className="post-image image-frame" href={`#article/${post.slug}`}><img src={post.image} alt={post.alt} /><span className="post-type">{post.type}</span></a>
    <div className="post-meta"><span>{post.category}</span><span>{post.readTime}</span></div>
    <h3><a href={`#article/${post.slug}`}>{post.title}</a></h3>
    <p>{post.description}</p>
    <div className="post-footer"><span>By {post.author}</span><button className={`bookmark ${saved ? 'is-saved' : ''}`} type="button" onClick={onSave} aria-label={`${saved ? 'Remove' : 'Save'} ${post.title}`}><span>{saved ? '♥' : '♡'}</span></button></div>
  </article>;
}

function HomeAdditions({ posts, onBrowseTopic }) {
  const featuredPost = posts.find((post) => post.featured) || posts[0];
  const supportingPosts = posts.filter((post) => post.slug !== featuredPost?.slug).slice(0, 2);

  return <>
    {supportingPosts.length > 0 && <section className="home-issue content-wrap" aria-labelledby="home-issue-title">
      <div className="home-section-heading"><div><p className="eyebrow">MORE FROM THE NOTEBOOK</p><h2 id="home-issue-title">Continue<br /><em>exploring.</em></h2></div><a className="text-link" href="#journal">View all notes <span aria-hidden="true">↗</span></a></div>
      <div className="home-issue-grid home-supporting-only"><div className="home-supporting-list" aria-label="More from the journal">{supportingPosts.map((post, index) => <a className="home-supporting-story" href={`#article/${post.slug}`} key={post.slug}><span className="home-supporting-number">0{index + 1}</span><ImageFrame className="home-supporting-image" src={post.image} alt={post.alt} /><span className="home-supporting-copy"><span className="home-story-category">{post.category} · {post.readTime}</span><strong>{post.title}</strong><span>{post.description}</span></span><span className="home-story-arrow" aria-hidden="true">↗</span></a>)}</div></div>
    </section>}
    <section className="home-topics content-wrap" aria-label="Explore by topic"><div><p className="eyebrow">FOLLOW A THREAD</p><h2>What are you<br /><em>thinking about?</em></h2></div><div className="home-topic-links">{filters.filter((filter) => filter !== 'all').map((filter, index) => <a href="#journal" onClick={() => onBrowseTopic(filter)} key={filter}><span>0{index + 1}</span>{filter}<span aria-hidden="true">↗</span></a>)}</div></section>
    <section className="home-letter-band"><div className="home-letter-inner content-wrap"><div><p className="eyebrow">A GOOD THING IN YOUR INBOX</p><h2>Sunday, read<br /><em>slowly.</em></h2></div><p>Thoughtful notes on creative work and modern life, delivered once a week.</p><a className="button button-light" href="#newsletter">Get the Sunday letter <span aria-hidden="true">↗</span></a></div></section>
  </>;
}

function HomeHero({ feature }) {
  return <section className="home-hero">
    <img className="home-hero-photo" src={feature?.image || 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=1800&q=90'} alt={feature?.alt || 'Open book and notes beside a sunny window'} />
    <div className="home-hero-inner content-wrap">
      <div className="home-hero-copy reveal">
        <p className="home-hero-kicker">FIELD NOTES <span /> INDEPENDENT JOURNAL · ISSUE 08</p>
        <h1>Make room<br /><em>for better thinking.</em></h1>
        <p className="home-hero-intro">A quiet corner for useful ideas on creative work, modern life, and the art of paying attention.</p>
        <div className="home-hero-actions"><a className="home-hero-primary" href={feature ? `#article/${feature.slug}` : '#journal'}>{feature ? 'Read the featured story' : 'Explore the journal'} <span aria-hidden="true">↗</span></a><a href="#journal">Browse all notes <span aria-hidden="true">↓</span></a></div>
      </div>
      <a className="home-hero-feature" href={feature ? `#article/${feature.slug}` : '#journal'}><span>ON THE COVER</span><strong>{feature?.title || 'Ideas for a more considered day'}</strong><span>{feature ? `${feature.category} · ${feature.readTime} · ${feature.author}` : 'Stories on creative work and modern life'}</span><b aria-hidden="true">↗</b></a>
      <div className="home-hero-footer"><span>AN INDEPENDENT JOURNAL FOR THE DELIBERATELY CURIOUS</span><span>SCROLL TO EXPLORE <b aria-hidden="true">↓</b></span></div>
    </div>
  </section>;
}

function App() {
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || 'home');
  const [posts, setPosts] = useState(() => isApiConfigured ? [] : readPosts());
  const [activeFilter, setActiveFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [savedPosts, setSavedPosts] = useState([]);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [contentError, setContentError] = useState('');
  const [contentLoading, setContentLoading] = useState(isApiConfigured);

  useEffect(() => {
    const syncRoute = () => setRoute(window.location.hash.slice(1) || 'home');
    window.addEventListener('hashchange', syncRoute);
    return () => window.removeEventListener('hashchange', syncRoute);
  }, []);

  useEffect(() => {
    if (isApiConfigured) {
      loadPublicPosts().then((result) => {
        const serverPosts = Array.isArray(result) ? result : result.posts;
        if (Array.isArray(serverPosts)) setPosts(serverPosts);
      }).catch((error) => setContentError(`The journal could not load from the blog API: ${error.message}`)).finally(() => setContentLoading(false));
      return undefined;
    }

    const syncPosts = () => setPosts(readPosts());
    window.addEventListener('storage', syncPosts);
    window.addEventListener(STORE_UPDATED_EVENT, syncPosts);
    return () => {
      window.removeEventListener('storage', syncPosts);
      window.removeEventListener(STORE_UPDATED_EVENT, syncPosts);
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setMenuOpen(false);
    setSearchOpen(false);
  }, [route]);

  const page = route.split('/')[0];
  const publishedPosts = posts.filter((post) => post.status !== 'draft');
  const homeFeature = publishedPosts.find((post) => post.featured) || publishedPosts[0];
  const article = page === 'article' ? publishedPosts.find((post) => post.slug === route.split('/')[1]) : null;

  const visiblePosts = publishedPosts.filter((post) => {
    const matchesFilter = activeFilter === 'all' || post.category === activeFilter;
    const term = query.trim().toLowerCase();
    return matchesFilter && (!term || post.title.toLowerCase().includes(term) || post.category.toLowerCase().includes(term));
  });

  const toggleSaved = (title) => setSavedPosts((current) => current.includes(title) ? current.filter((item) => item !== title) : [...current, title]);
  const handleSubscribe = (event) => {
    event.preventDefault();
    setMessage(`You're on the list. Watch ${email} for Sunday's note.`);
    setEmail('');
  };

  return <>
    <div className="announcement"><span className="pulse" /> Issue 08 is out now <a href="#journal">Read the dispatch <span aria-hidden="true">↗</span></a></div>
    <header className="site-header">
      <Wordmark />
      <nav className={`main-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation"><a href="#home" aria-current={page === 'home' ? 'page' : undefined}>Home</a><a href="#journal" aria-current={page === 'journal' ? 'page' : undefined}>Journal</a><a href="#about" aria-current={page === 'about' ? 'page' : undefined}>About</a></nav>
      <div className="header-actions"><button className="icon-button" type="button" aria-label="Open search" aria-expanded={searchOpen} onClick={() => setSearchOpen((open) => !open)}><span className="search-icon" /></button><a className="button button-dark header-cta" href="#newsletter">Subscribe <span aria-hidden="true">↗</span></a><button className="menu-toggle" type="button" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><span /><span /></button></div>
      {searchOpen && <form className="search-panel is-open" role="search" onSubmit={(event) => { event.preventDefault(); window.location.hash = 'journal'; }}><label htmlFor="searchInput">Search the archive</label><div className="search-field"><input id="searchInput" type="search" placeholder="Try “creative practice”" value={query} onChange={(event) => setQuery(event.target.value)} autoFocus /><button type="submit">Search <span aria-hidden="true">↗</span></button></div></form>}
    </header>

    <main id="top">
      {contentError && <p className="content-load-error content-wrap" role="status">{contentError}</p>}
      {page === 'home' && <><HomeHero feature={homeFeature} /><HomeAdditions posts={publishedPosts} onBrowseTopic={setActiveFilter} /></>}

      {page === 'journal' && <><section className="page-intro journal-cover content-wrap"><p className="eyebrow">Fresh from the notebook</p><h1>Latest notes.</h1><p>Essays, field guides, and dispatches for a more considered day.</p><span className="cover-index">FIELD NOTES / VOL. 08</span></section><section className="topic-bar content-wrap" aria-label="Browse topics"><span className="topic-label">Browse by</span><div className="topic-filters" role="tablist">{filters.map((filter) => <button className={`filter-button ${activeFilter === filter ? 'is-active' : ''}`} data-filter={filter} role="tab" aria-selected={activeFilter === filter} key={filter} onClick={() => setActiveFilter(filter)}>{filter === 'all' ? 'All notes' : filter}</button>)}</div></section><section className="latest content-wrap"><div className="section-heading"><div><p className="eyebrow">Issue 08</p><h2>From the journal</h2></div><span className="issue-count">{visiblePosts.length} NOTES</span></div><div className="post-grid">{visiblePosts.map((post, index) => <PostCard post={post} featured={index === 0 && activeFilter === 'all'} saved={savedPosts.includes(post.title)} onSave={() => toggleSaved(post.title)} key={post.title} />)}</div>{visiblePosts.length === 0 && <p className="empty-state">{contentLoading ? 'Loading notes…' : 'No notes found. Try another search or topic.'}</p>}</section></>}

      {page === 'article' && article && <article className="article-page content-wrap"><a className="text-link back-link" href="#journal"><span aria-hidden="true">←</span> Back to journal</a><header className="article-heading"><p className="eyebrow">{article.category} · {article.readTime}</p><h1>{article.title}</h1><p>{article.description}</p><span className="article-byline">By {article.author}</span></header><ImageFrame className="article-image" src={article.image} alt={article.alt} /><div className="article-body">{article.content.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<a className="text-link" href="#journal">More from the journal <span aria-hidden="true">↗</span></a></div></article>}

      {page === 'article' && !article && <section className="page-intro content-wrap"><p className="eyebrow">Not found</p><h1>That note isn't here.</h1><a className="text-link" href="#journal">Return to journal <span aria-hidden="true">↗</span></a></section>}

      {page === 'about' && <section className="about-page content-wrap"><p className="eyebrow">Our point of view</p><h1>Paying attention<br /><em>is a practice.</em></h1><ImageFrame className="about-image" src="https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1800&q=85" alt="Sunlight falling through a quiet forest" /><div className="manifesto"><div className="manifesto-label">A note from the editors</div><blockquote>“Attention is the beginning of devotion.”<cite>— Mary Oliver</cite></blockquote><div className="manifesto-copy"><p>We believe a good life is built from questions you return to. From the books you underline, the walks you take the long way through, and the work you keep coming back to.</p><p>Field Notes is an independent journal about creative work, modern life, and the art of paying attention. Made slowly, read at your own pace.</p></div></div><a className="text-link" href="#newsletter">Get the Sunday letter <span aria-hidden="true">↗</span></a></section>}

      {page === 'newsletter' && <section className="newsletter-page content-wrap"><div><p className="eyebrow">The Sunday letter</p><h1>A little clarity,<br /><em>once a week.</em></h1></div><div className="newsletter-image"><ImageFrame src="https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=900&q=85" alt="A notebook and coffee ready for a quiet morning" /></div><div className="newsletter-form-wrap"><p>One thoughtful dispatch, occasional reading lists, and no noise. Delivered every Sunday morning.</p><form className="newsletter-form" onSubmit={handleSubscribe}><label className="sr-only" htmlFor="email">Email address</label><input id="email" type="email" placeholder="Your email address" required value={email} onChange={(event) => setEmail(event.target.value)} /><button className="button button-dark" type="submit">Join the list <span aria-hidden="true">↗</span></button></form><p className="form-message" role="status">{message}</p></div></section>}
    </main>
    <footer className="site-footer content-wrap"><Wordmark /><p>Ideas worth keeping.</p><div className="footer-links"><a href="#about">About</a><a href="#journal">Journal</a><a href="#newsletter">Newsletter</a></div><span className="copyright">© 2024 Field Notes</span></footer>
  </>;
}

export default App;

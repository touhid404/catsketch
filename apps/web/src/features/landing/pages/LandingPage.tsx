import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  Layers,
  Link,
  MousePointer2,
  Pencil,
  Plus,
  Sparkles,
  Users,
  Headphones,
} from 'lucide-react';
import { Brand } from '../../../components/ui/Brand';
import { recentRooms } from '../../rooms/lib/guest-session';
import type { Template } from '../types';
export default function Landing({
  onCreate,
  onJoin,
}: {
  onCreate: (template: Template) => void;
  onJoin: () => void;
}) {
  const rooms = recentRooms();
  return (
    <div className="landing">
      <header className="site-header">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#possibilities">Made for your ideas</a>
          <button className="button button-outline button-small" onClick={onJoin}>
            Join a space <ArrowUpRight size={16} />
          </button>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="hero-badge">
              <span className="live-dot" /> SMALL TEAMS. BIG POSSIBILITIES.
            </div>
            <h1>
              Good ideas need
              <br />a little{' '}
              <span className="hero-emphasis">
                space
                <svg viewBox="0 0 290 22" preserveAspectRatio="none">
                  <path
                    d="M3 12Q140 -3 286 9M12 19Q148 6 274 15"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              .
            </h1>
            <p>
              A shared whiteboard. A live audio conversation.
              <br className="desktop-break" /> A place to think out loud, together.
            </p>
            <div className="hero-actions">
              <button className="button button-primary" onClick={() => onCreate('blank')}>
                Create a space <ArrowRight size={19} />
              </button>
              <button className="text-button" onClick={onJoin}>
                Join with a link <ArrowUpRight size={17} />
              </button>
            </div>
            <div className="hero-reassurance">
              <span>
                <Check size={14} /> Free to get started
              </span>
              <span>
                <Check size={14} /> No account needed
              </span>
            </div>
            <div className="hero-note">
              <svg width="48" height="32" viewBox="0 0 48 32">
                <path
                  d="M46 25C21 31 13 16 20 6M20 6L12 9M20 6L25 13"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
              <span>Less setting up. More making things.</span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="visual-scribble">a little messy. a lot of possibility.</div>
            <div className="demo-board">
              <div className="demo-header">
                <span className="demo-window-dots">
                  <i />
                  <i />
                  <i />
                </span>
                <span>The next big thing</span>
                <span className="demo-shared">
                  <Users size={12} /> Shared space
                </span>
              </div>
              <div className="demo-canvas">
                <div className="demo-tools">
                  <MousePointer2 size={15} className="demo-tool-active" />
                  <Pencil size={15} />
                  <span className="tool-square" />
                  <span className="tool-circle" />
                  <ArrowUpRight size={17} />
                  <span>T</span>
                </div>
                <span className="demo-board-title">Okay, hear me out…</span>
                <svg className="demo-connections" viewBox="0 0 600 380" aria-hidden="true">
                  <defs>
                    <marker
                      id="demo-arrow"
                      markerWidth="8"
                      markerHeight="8"
                      refX="5"
                      refY="3"
                      orient="auto"
                    >
                      <path d="M0 0L6 3L0 6" fill="none" stroke="#69726a" strokeWidth="1.2" />
                    </marker>
                  </defs>
                  <path
                    d="M180 178C214 134 233 145 270 180M385 190C425 200 439 171 477 164M302 255Q316 290 378 295"
                    stroke="#69726a"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    fill="none"
                    markerEnd="url(#demo-arrow)"
                    strokeDasharray="5 4"
                  />
                </svg>
                <div className="demo-note note-yellow">
                  <span className="note-small">THE BIG QUESTION</span>
                  <strong>
                    What if we
                    <br />
                    built it together?
                  </strong>
                  <span className="note-star">✳</span>
                </div>
                <div className="demo-note note-mint">
                  <strong>
                    Make it simple.
                    <br />
                    Make it human.
                  </strong>
                  <span className="note-check">✓</span>
                </div>
                <div className="demo-idea">
                  <span>
                    less friction,
                    <br />
                    more flow
                  </span>
                  <svg viewBox="0 0 155 74">
                    <ellipse
                      cx="77"
                      cy="37"
                      rx="72"
                      ry="30"
                      fill="none"
                      stroke="#b19bc8"
                      strokeWidth="1.8"
                      transform="rotate(-8 77 37)"
                    />
                  </svg>
                </div>
                <div className="demo-sticky">
                  <span>
                    Build. Share.
                    <br />
                    See what happens.
                  </span>
                </div>
                <div className="demo-cursor cursor-alex">
                  <MousePointer2 size={20} fill="currentColor" />
                  <span>Alex</span>
                </div>
                <div className="demo-cursor cursor-sam">
                  <MousePointer2 size={20} fill="currentColor" />
                  <span>Sam</span>
                </div>
                <div className="demo-zoom">
                  − <span>100%</span> +
                </div>
              </div>
              <div className="demo-bottom">
                <span>
                  <span className="live-dot" /> A little room for everyone
                </span>
                <span>
                  <Headphones size={13} /> Think out loud
                </span>
              </div>
            </div>
            <div className="floating-call">
              <div className="call-avatars">
                <span>A</span>
                <span>S</span>
                <span>J</span>
              </div>
              <div>
                <strong>Ideas are better together</strong>
                <span>Your people, one link away.</span>
              </div>
              <span className="call-wave">
                <i />
                <i />
                <i />
                <i />
              </span>
            </div>
            <div className="floating-label">
              <Sparkles size={15} /> Your next “aha!” starts here
            </div>
          </div>
        </section>
        <div className="use-case-strip">
          <span>A LITTLE SPACE FOR</span>
          <div>
            Big brainstorms <span>✳</span> Quick sketches <span>✳</span> Better conversations{' '}
            <span>✳</span> Whatever’s next
          </div>
        </div>
        <section className="start-section" id="possibilities">
          <div className="section-heading">
            <div>
              <div className="eyebrow">AN EMPTY CANVAS. ENDLESS POSSIBILITIES.</div>
              <h2>Where do you want to start?</h2>
            </div>
            <span className="section-aside">
              Pick a starting point. Make it your own. <ArrowDown size={17} />
            </span>
          </div>
          <div className="template-grid">
            <button className="template-card template-blank" onClick={() => onCreate('blank')}>
              <div className="template-art blank-art">
                <span>
                  <Plus size={24} />
                </span>
                <div className="blank-label">your idea goes here</div>
              </div>
              <div className="template-info">
                <div>
                  <h3>A blank canvas</h3>
                  <p>Start fresh. See where it takes you.</p>
                </div>
                <span className="template-arrow">
                  <ArrowUpRight size={20} />
                </span>
              </div>
            </button>
            <button className="template-card" onClick={() => onCreate('brainstorm')}>
              <div className="template-art brainstorm-art">
                <div className="mini-note mini-yellow">what if…</div>
                <div className="mini-note mini-purple">why not?</div>
                <div className="mini-note mini-green">let’s try!</div>
                <svg viewBox="0 0 300 150">
                  <path
                    d="M94 95Q128 145 165 95M164 62Q189 29 220 72"
                    stroke="#aaa397"
                    strokeWidth="1.5"
                    fill="none"
                    strokeDasharray="4 4"
                  />
                </svg>
              </div>
              <div className="template-info">
                <div>
                  <h3>A big brainstorm</h3>
                  <p>Get every idea out of your head.</p>
                </div>
                <span className="template-arrow">
                  <ArrowUpRight size={20} />
                </span>
              </div>
            </button>
            <button className="template-card" onClick={() => onCreate('architecture')}>
              <div className="template-art architecture-art">
                <div className="mini-node">Client</div>
                <span className="mini-connector">⟶</span>
                <div className="mini-node">API</div>
                <span className="mini-connector">⟶</span>
                <div className="mini-node mini-database">Data</div>
              </div>
              <div className="template-info">
                <div>
                  <h3>Connect the dots</h3>
                  <p>Turn a complex thought into a clear plan.</p>
                </div>
                <span className="template-arrow">
                  <ArrowUpRight size={20} />
                </span>
              </div>
            </button>
          </div>
        </section>
        {rooms.length > 0 && (
          <section className="recent-section">
            <div className="section-heading">
              <h2>Your recent spaces</h2>
              <span className="section-aside">
                <Clock3 size={15} /> Saved on this browser
              </span>
            </div>
            <div className="recent-grid">
              {rooms.map((room) => (
                <a href={`/room/${room.roomCode}`} className="recent-room" key={room.roomCode}>
                  <Layers size={20} />
                  <div>
                    <strong>{room.title}</strong>
                    <span>
                      Open until{' '}
                      {new Date(room.expiresAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <ArrowUpRight size={18} />
                </a>
              ))}
            </div>
          </section>
        )}
        <section className="how-section" id="how-it-works">
          <div className="how-intro">
            <div className="eyebrow">COLLABORATION, WITHOUT THE COMPLICATION.</div>
            <h2>
              From “hey, I have an idea”
              <br />
              to “let’s make it happen.”
            </h2>
            <p>No sign-ups. No downloads. No getting in the way.</p>
          </div>
          <div className="how-steps">
            <div>
              <span className="step-icon">
                <Plus size={22} />
              </span>
              <div>
                <span className="step-number">01</span>
                <h3>Make a little space</h3>
                <p>Give yourself a name and open a fresh whiteboard.</p>
              </div>
            </div>
            <div>
              <span className="step-icon">
                <Link size={22} />
              </span>
              <div>
                <span className="step-number">02</span>
                <h3>Bring your people</h3>
                <p>Share one link. Your team can jump right in.</p>
              </div>
            </div>
            <div>
              <span className="step-icon">
                <Pencil size={22} />
              </span>
              <div>
                <span className="step-number">03</span>
                <h3>Let the ideas flow</h3>
                <p>Sketch, talk, and figure things out in real time.</p>
              </div>
            </div>
          </div>
        </section>
        <section className="closing-cta">
          <span>✳</span>
          <h2>Something good starts with a little space.</h2>
          <button className="button button-primary" onClick={() => onCreate('blank')}>
            Let’s make something <ArrowRight size={18} />
          </button>
        </section>
      </main>
      <footer className="site-footer">
        <Brand small />
        <span>Made for thinking together.</span>
        <div>
          <span className="live-dot" /> Just a name. Just a link. Just like that.
        </div>
      </footer>
    </div>
  );
}

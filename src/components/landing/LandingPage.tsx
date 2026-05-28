import { BeeDefs, BeeIcon } from "./BeeLogo";

export function LandingPage() {
  return (
    <>
      <BeeDefs />

      <header>
        <div className="nav">
          <a className="brand" href="#top">
            <BeeIcon />
            <span className="brand-name">
              Bumble<span className="hub">Hub</span>
            </span>
          </a>
          <div className="nav-actions">
            <a className="nav-link hide-sm" href="#features">
              Features
            </a>
            <a className="nav-link hide-sm" href="#how">
              How it works
            </a>
            <a className="btn btn-primary" href="/login">
              Log in
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div>
            <div className="eyebrow reveal d1">
              <span className="dot" />
              The home, humming
            </div>
            <h1 className="hero-title reveal d2">
              Your whole home,
              <br />
              one <em>warm</em> little screen.
            </h1>
            <p className="hero-sub reveal d3">
              BumbleHub is the calm dashboard for your house. Set the lights and
              the vibe with one tap, follow recipes with a cooking helper that
              actually answers questions, and let the place feel ready the
              moment anyone walks in — no phones, no juggling five different
              apps.
            </p>
            <div className="hero-cta reveal d4">
              <a className="btn btn-honey" href="/login">
                Open my Hive
              </a>
              <a className="btn btn-primary" href="#features">
                See what it does
              </a>
            </div>
            <p className="hero-note reveal d4">
              Made for the screen on your wall — and your phone when you&apos;re
              on the way home.
            </p>
          </div>
          <div className="hero-art reveal d2">
            <BeeIcon className="hero-bee" />
          </div>
        </section>

        <div className="showcase">
          <div className="device reveal d3">
            <div className="device-bar">
              <i />
              <i />
              <i />
            </div>
            <div className="dash">
              <div className="dash-head">
                <div>
                  <div className="dash-clock">5:47</div>
                  <div className="dash-date">Thursday, May 28 · Home</div>
                </div>
                <div className="dash-weather">
                  <span style={{ fontSize: 22 }}>☀️</span>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--charcoal)" }}>
                      72°
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      Clear
                    </div>
                  </div>
                </div>
              </div>
              <div className="tile active">
                <div className="ic">☀️</div>
                <div>
                  <div className="lbl">Coming home</div>
                  <div className="sub">Scene</div>
                </div>
              </div>
              <div className="tile">
                <div className="ic">🍳</div>
                <div>
                  <div className="lbl">Cooking</div>
                  <div className="sub">Scene</div>
                </div>
              </div>
              <div className="tile">
                <div className="ic">🌙</div>
                <div>
                  <div className="lbl">Sleeping</div>
                  <div className="sub">Scene</div>
                </div>
              </div>
              <div className="nowplaying">
                <div className="np-art">♪</div>
                <div style={{ flex: 1 }}>
                  <div className="np-label">Now playing</div>
                  <div className="np-track">Watermelon Crawl</div>
                  <div className="np-artist">Tracy Byrd</div>
                </div>
                <span style={{ fontSize: 24, color: "var(--charcoal)" }}>⏸</span>
              </div>
            </div>
          </div>
        </div>

        <section className="block" id="features">
          <div className="section-eyebrow">What it does</div>
          <h2 className="section-title">
            Everything your home needs to feel ready.
          </h2>
          <p className="section-lead">
            One screen for the things you reach for every day. Tap a scene,
            start the music, pull up dinner — and never go hunting through a
            drawer of single-purpose apps again.
          </p>

          <div className="features">
            <div className="feature">
              <div className="fic">💡</div>
              <h3>Scenes, one tap</h3>
              <p>
                Lights, music, and the mood, set together. &quot;Coming
                home&quot; warms the lights and starts the playlist while
                you&apos;re still in the driveway.
              </p>
            </div>
            <div className="feature">
              <div className="fic">🎵</div>
              <h3>Music, front and center</h3>
              <p>
                Your playlists and what&apos;s playing, always a tap away.
                Connected to Spotify and ready to fill the kitchen.
              </p>
            </div>
            <div className="feature">
              <div className="fic">🍳</div>
              <h3>Recipes that talk back</h3>
              <p>
                Follow a recipe step by step with big, hands-free text — and ask
                it anything. &quot;No buttermilk?&quot; &quot;Halve this?&quot;
                It answers.
              </p>
            </div>
            <div className="feature">
              <div className="fic">🌡️</div>
              <h3>Climate &amp; comfort</h3>
              <p>
                The temperature set the way you like it, on a schedule that
                follows your day. Warm before you arrive, cool when you sleep.
              </p>
            </div>
            <div className="feature">
              <div className="fic">🛒</div>
              <h3>Shared lists &amp; tasks</h3>
              <p>
                The family shopping list and the week&apos;s to-dos, in one
                place everyone in the house can see and check off.
              </p>
            </div>
            <div className="feature">
              <div className="fic">🖼️</div>
              <h3>A frame when it&apos;s idle</h3>
              <p>
                When no one&apos;s tapping, the screen drifts into your favorite
                photos — a quiet bit of warmth on the wall.
              </p>
            </div>
          </div>
        </section>

        <div className="band" id="how">
          <div className="band-inner">
            <div className="section-eyebrow">How it works</div>
            <h2>Sign in, name your Hive, and the house starts working for you.</h2>
            <div className="steps">
              <div className="step">
                <div className="num">01</div>
                <h3>Make your Hive</h3>
                <p>
                  Each home is a Hive. Sign in, give it a name, and you&apos;ve
                  got a dashboard ready for the wall, your phone, and any screen
                  in between.
                </p>
              </div>
              <div className="step">
                <div className="num">02</div>
                <h3>Connect the house</h3>
                <p>
                  Link your lights, music, and thermostat. BumbleHub gathers
                  them into one calm place so you stop app-hopping.
                </p>
              </div>
              <div className="step">
                <div className="num">03</div>
                <h3>Set your scenes</h3>
                <p>
                  Tell it what &quot;morning,&quot; &quot;dinner,&quot; and
                  &quot;goodnight&quot; mean once. After that, the whole room
                  changes with a single tap.
                </p>
              </div>
            </div>
          </div>
        </div>

        <section className="closer">
          <BeeIcon className="hero-bee-sm" />
          <h2>Come on in. The Hive&apos;s ready.</h2>
          <p>
            Put your home on BumbleHub and let it hum along quietly in the
            background, so walking through the door always feels like coming
            home.
          </p>
          <a className="btn btn-honey btn-honey-lg" href="/login">
            Log in &amp; set up my home
          </a>
        </section>
      </main>

      <footer>
        <div className="foot">
          <a className="brand" href="#top">
            <BeeIcon style={{ width: 30, height: 30 }} />
            <span className="brand-name">
              Bumble<span className="hub">Hub</span>
            </span>
          </a>
          <small>
            © 2026 BumbleHub · A calmer way to run the house · bumblehub.dev
          </small>
        </div>
      </footer>
    </>
  );
}

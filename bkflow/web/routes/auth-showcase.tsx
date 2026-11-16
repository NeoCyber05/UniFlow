import { tr, useLocale } from "@/lib/i18n";

import "./auth-showcase.css";

const CONTOURS = Array.from({ length: 22 }, (_, i) => {
  const y = 40 + i * 42;
  return `M-60 ${y} C 180 ${y - (60 + i * 3)}, 420 ${y + (70 - i * 2)}, 860 ${y - 40 + i}`;
});

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const SlackMark = () => (
  <svg viewBox="0 0 24 24">
    <rect x="9.6" y="2" width="3.6" height="9" rx="1.8" fill="#36C5F0" />
    <rect x="2" y="9.6" width="9" height="3.6" rx="1.8" fill="#2EB67D" />
    <rect x="10.8" y="13" width="3.6" height="9" rx="1.8" fill="#ECB22E" />
    <rect x="13" y="9.6" width="9" height="3.6" rx="1.8" fill="#E01E5A" />
  </svg>
);

const TextIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M4 6h16M4 12h10M4 18h7" />
  </svg>
);

const PhotoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="12" cy="12" r="3.2" />
  </svg>
);

// AI assistant mascot (mint): pearl head, dark visor, glowing smile, holding a check card.
const Robot = () => (
  <svg className="bot" viewBox="0 0 160 160" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="as-pearl" x1="0" y1="0" x2=".3" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset=".55" stopColor="#eef0f6" />
        <stop offset="1" stopColor="#c9cedb" />
      </linearGradient>
      <linearGradient id="as-visor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#262a3b" />
        <stop offset="1" stopColor="#0a0c13" />
      </linearGradient>
      <linearGradient id="as-acc" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#5eead4" />
        <stop offset="1" stopColor="#10b981" />
      </linearGradient>
      <linearGradient id="as-card" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#5eead4" stopOpacity=".95" />
        <stop offset="1" stopColor="#10b981" stopOpacity=".85" />
      </linearGradient>
      <filter id="as-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" />
      </filter>
      <filter id="as-soft" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#14b8a6" floodOpacity=".45" />
      </filter>
    </defs>
    <ellipse className="shadow" cx="80" cy="150" rx="40" ry="5" fill="#000" opacity=".35" />
    <g className="float" filter="url(#as-soft)">
      <g className="antenna">
        <path d="M80 34V20" stroke="url(#as-pearl)" strokeWidth="4" strokeLinecap="round" />
        <circle cx="80" cy="15" r="9" fill="#5eead4" opacity=".45" filter="url(#as-glow)" />
        <circle cx="80" cy="15" r="6" fill="url(#as-acc)" />
        <circle cx="78" cy="13" r="1.8" fill="#fff" opacity=".9" />
      </g>
      <rect x="54" y="100" width="52" height="40" rx="20" fill="url(#as-pearl)" />
      <circle cx="80" cy="118" r="4" fill="url(#as-acc)" opacity=".9" />
      <rect x="40" y="104" width="18" height="30" rx="9" fill="url(#as-pearl)" transform="rotate(14 49 119)" />
      <rect x="18" y="52" width="20" height="34" rx="10" fill="url(#as-pearl)" />
      <rect x="22" y="58" width="9" height="22" rx="4.5" fill="#5eead4" opacity=".55" filter="url(#as-glow)" />
      <rect x="22" y="58" width="9" height="22" rx="4.5" fill="url(#as-acc)" opacity=".85" />
      <rect x="122" y="52" width="20" height="34" rx="10" fill="url(#as-pearl)" />
      <rect x="129" y="58" width="9" height="22" rx="4.5" fill="url(#as-acc)" opacity=".85" />
      <rect x="30" y="30" width="100" height="78" rx="36" fill="url(#as-pearl)" />
      <path d="M44 42c10-8 30-11 44-10" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".9" />
      <rect x="42" y="44" width="76" height="50" rx="24" fill="url(#as-visor)" />
      <path d="M52 52c8-4 22-5 32-4" stroke="#fff" strokeOpacity=".14" strokeWidth="3" strokeLinecap="round" />
      <g className="eyes">
        <path d="M57 74q8-10 16 0M87 74q8-10 16 0" stroke="#5eead4" strokeWidth="7" strokeLinecap="round" opacity=".7" filter="url(#as-glow)" />
        <path d="M57 74q8-10 16 0M87 74q8-10 16 0" stroke="#5eead4" strokeWidth="4.6" strokeLinecap="round" />
      </g>
      <circle cx="56" cy="83" r="4" fill="#10b981" opacity=".35" />
      <circle cx="104" cy="83" r="4" fill="#10b981" opacity=".35" />
      <g transform="rotate(-8 116 120)">
        <rect x="94" y="98" width="46" height="42" rx="11" fill="url(#as-card)" />
        <rect x="94" y="98" width="46" height="42" rx="11" stroke="#fff" strokeOpacity=".55" strokeWidth="1.5" />
        <path d="M98 104h22" stroke="#fff" strokeOpacity=".35" strokeWidth="3" strokeLinecap="round" />
        <path className="tick" pathLength={1} d="M105 120l7 7 15-15" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <rect x="86" y="118" width="18" height="18" rx="9" fill="url(#as-pearl)" />
    </g>
  </svg>
);

/** Left panel of the sign-in page: animated "message / photo / apps -> AI -> tasks" flow. Decorative. */
export const AuthShowcase = ({ className = "" }: { className?: string }) => {
  useLocale((s) => s.locale); // re-render on language switch

  return (
    <section className={`auth-show ${className}`}>
      <div className="bg dots" aria-hidden="true" />
      <div className="bg aurora" aria-hidden="true">
        <span className="blob b1" />
        <span className="blob b2" />
        <span className="blob b3" />
        <span className="blob b4" />
        <span className="blob b5" />
      </div>
      <svg className="bg contours" viewBox="0 0 800 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g>
          {CONTOURS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </svg>
      <div className="bg grain" aria-hidden="true" />
      <div className="bg vignette" aria-hidden="true" />

      <div className="brand">
        <img src="/logo.svg" alt="" aria-hidden="true" />
        UniFlow
      </div>

      <div className="copy">
        <h2 className="headline">
          {tr("auth.show.headline1")}
          <br />
          <em>{tr("auth.show.headline2")}</em>
        </h2>
        <p className="lede">{tr("auth.show.lede")}</p>
      </div>

      <div className="stage-wrap" aria-hidden="true">
        <div className="stage-box">
          <div className="stage">
            <svg className="wires" viewBox="0 0 640 420">
              <defs>
                <radialGradient id="as-dot">
                  <stop offset="0" stopColor="#ccfbf1" />
                  <stop offset="1" stopColor="#14b8a6" stopOpacity="0" />
                </radialGradient>
              </defs>
              <path id="as-w1" className="wire" d="M204 61 C 244 61, 240 196, 278 200" />
              <path id="as-w2" className="wire" d="M204 208 C 236 208, 248 206, 276 206" />
              <path id="as-w3" className="wire" d="M204 340 C 244 340, 240 216, 278 212" />
              <path className="wire out" d="M366 198 C 394 194, 390 66, 420 66" />
              <path className="wire out" d="M368 206 C 392 206, 396 204, 420 204" />
              <path className="wire out" d="M366 214 C 394 218, 390 342, 420 342" />
              {["as-w1", "as-w2", "as-w3"].map((id, i) => (
                <g key={id}>
                  <circle r="7" fill="url(#as-dot)">
                    <animateMotion dur="2.4s" repeatCount="indefinite" begin={`${i * 0.8}s`}>
                      <mpath href={`#${id}`} />
                    </animateMotion>
                  </circle>
                  <circle r="2.2" fill="#fff">
                    <animateMotion dur="2.4s" repeatCount="indefinite" begin={`${i * 0.8}s`}>
                      <mpath href={`#${id}`} />
                    </animateMotion>
                  </circle>
                </g>
              ))}
            </svg>

            <div className="node n-text">
              <div className="node-h">
                <i><TextIcon /></i>
                {tr("auth.show.inText")}
              </div>
              <p className="msg">
                {tr("auth.show.msg1")}
                <mark>{tr("auth.show.msg2")}</mark>
                {tr("auth.show.msg3")}
                <mark>{tr("auth.show.msg4")}</mark>
                {tr("auth.show.msg5")}
                <span className="caret" />
              </p>
            </div>

            <div className="node n-img">
              <div className="node-h">
                <i><PhotoIcon /></i>
                {tr("auth.show.inImage")}
              </div>
              <div className="photo">
                <div className="paper">
                  <span className="pin" />
                  <div className="t" />
                  <div className="l" style={{ width: "88%" }} />
                  <div className="hl" />
                  <div className="l" style={{ width: "72%" }} />
                  <div className="l" style={{ width: "80%" }} />
                  <div className="l" style={{ width: "55%" }} />
                  <div className="detect" />
                </div>
                <div className="scan" />
              </div>
            </div>

            <div className="node n-apps">
              <div className="node-h">
                <i>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
                  </svg>
                </i>
                {tr("auth.show.inApps")}
              </div>
              <div className="apps">
                <div className="app" title="Gmail">
                  <svg viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M2 6.5V18a1.5 1.5 0 0 0 1.5 1.5H6V11l-4-4.5z" />
                    <path fill="#34A853" d="M18 19.5h2.5A1.5 1.5 0 0 0 22 18V6.5L18 11z" />
                    <path fill="#FBBC04" d="M18 5.2V11l4-4.5V6a1.6 1.6 0 0 0-2.6-1.3z" />
                    <path fill="#EA4335" d="M6 11V5.2l6 4.5 6-4.5V11l-6 4.5z" />
                    <path fill="#C5221F" d="M2 6v.5L6 11V5.2l-1.4-1A1.6 1.6 0 0 0 2 6z" />
                  </svg>
                </div>
                <div className="app" title="Slack"><SlackMark /></div>
                <div className="app" title="Microsoft Teams">
                  <svg viewBox="0 0 24 24">
                    <circle cx="17.5" cy="6.5" r="2.5" fill="#7B83EB" />
                    <rect x="14" y="10" width="8" height="8" rx="3" fill="#7B83EB" />
                    <rect x="2" y="5" width="13" height="13" rx="2.2" fill="#5059C9" />
                    <path d="M5.2 8.6h6.6v1.7H9.4v5.6H7.6v-5.6H5.2z" fill="#fff" />
                  </svg>
                </div>
                <div className="app" title="Google Calendar">
                  <svg viewBox="0 0 24 24">
                    <rect x="3" y="3" width="18" height="18" rx="2.5" fill="#fff" stroke="#4285F4" strokeWidth="2" />
                    <rect x="3" y="3" width="18" height="5" rx="2" fill="#4285F4" />
                    <text x="12" y="17.6" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#1a73e8" fontFamily="Arial">31</text>
                  </svg>
                </div>
              </div>
            </div>

            <div className="hub">
              <span className="halo" />
              <Robot />
              <div className="hub-label">
                <b>{tr("auth.show.hub")}</b>
                <span>{tr("auth.show.hubStatus")}</span>
              </div>
            </div>

            <div className="out-h">
              {tr("auth.show.outTitle")}
              <b>3</b>
            </div>
            <div className="task t1">
              <div className="course">{tr("auth.show.t1Course")}</div>
              <div className="title">{tr("auth.show.t1Title")}</div>
              <div className="meta">
                <span className="chip due"><ClockIcon />{tr("auth.show.t1Due")}</span>
                <span className="chip src"><TextIcon />{tr("auth.show.t1Source")}</span>
              </div>
            </div>
            <div className="task t2">
              <div className="course">{tr("auth.show.t2Course")}</div>
              <div className="title">{tr("auth.show.t2Title")}</div>
              <div className="meta">
                <span className="chip due"><ClockIcon />{tr("auth.show.t2Due")}</span>
                <span className="chip chk">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12l5 5L20 6" />
                  </svg>
                  0/3
                </span>
                <span className="chip src"><PhotoIcon />{tr("auth.show.t2Source")}</span>
              </div>
            </div>
            <div className="task t3">
              <div className="course">{tr("auth.show.t3Course")}</div>
              <div className="title">{tr("auth.show.t3Title")}</div>
              <div className="meta">
                <span className="chip due soft">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M3 10h18M8 3v4M16 3v4" />
                  </svg>
                  {tr("auth.show.t3Due")}
                </span>
                <span className="chip src"><SlackMark />Slack</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

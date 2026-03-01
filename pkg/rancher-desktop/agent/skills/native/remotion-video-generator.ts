import type { NativeSkillDefinition } from './NativeSkillRegistry';

export const remotionVideoGeneratorSkill: NativeSkillDefinition = {
  name: 'remotion-video-generator',
  description: 'Create professional motion graphics videos programmatically with React and Remotion. Triggers on "generate video", "create video", "make a video", "remotion", "motion graphics", "video generator", "product video", "promo video".',
  tags: ['video', 'remotion', 'motion-graphics', 'react', 'animation', 'render', 'mp4', 'promo', 'product-video'],
  version: '1.0',
  async func(_input) {
    return `# Video Generator (Remotion)

Create professional motion graphics videos programmatically with React and Remotion.

---

## Remotion Studio Extension

Remotion Studio runs as a **Docker extension** managed by Sulla Desktop.

- **Extension slug:** \`docker.io/sulla-ai/remotion\`
- **Install version:** \`docker.io/sulla-ai/remotion:2026.02\`
- **Container name:** \`sulla_remotion_studio\`
- **Port:** \`30310\` (maps to 3000 inside the container)
- **Studio URL:** \`http://localhost:30310\`
- **Volumes:**
  - \`remotion-projects\` → \`/app/projects\` (where video project source files live)
  - \`remotion-output\` → \`/app/out\` (where rendered videos are written)

---

## Tool Mapping

| Step | Tool | Notes |
|------|------|-------|
| Check if Remotion is installed | \`list_installed_extensions\` | Look for \`sulla-ai/remotion\` in the list |
| Install Remotion extension | \`install_extension\` | \`id: "docker.io/sulla-ai/remotion:2026.02"\` |
| Create project PRD | \`create_project\` | Creates the project folder + PROJECT.md (also creates the directory) |
| Create project dir in container | \`exec\` | \`docker exec sulla_remotion_studio mkdir -p /app/projects/<video-name>/src/scenes\` |
| Write source files in container | \`exec\` | \`docker exec sulla_remotion_studio sh -c "cat > /app/projects/<video-name>/src/Root.tsx << 'ENDOFFILE' ... ENDOFFILE"\` |
| Read files in container | \`exec\` | \`docker exec sulla_remotion_studio cat /app/projects/<video-name>/src/Root.tsx\` |
| Install npm packages in container | \`exec\` | \`docker exec sulla_remotion_studio sh -c "cd /app/projects/<video-name> && npm install lucide-react"\` |
| Scrape brand data | \`exec\` | curl to Firecrawl API |
| Download brand assets into container | \`exec\` | \`docker exec sulla_remotion_studio sh -c "curl -sL '<url>' -o /app/projects/<video-name>/public/images/brand/logo.png"\` |
| Show preview to user | \`manage_active_asset\` | Opens Remotion Studio at \`http://localhost:30310\` |
| Render final video | \`exec\` | \`docker exec sulla_remotion_studio sh -c "cd /app/projects/<video-name> && npx remotion render ..."\` |

---

## Default Workflow (ALWAYS follow this)

### 1. Ensure Remotion Studio is installed
\`\`\`
list_installed_extensions({})
\`\`\`
Look for \`sulla-ai/remotion\` in the results. If not found:
\`\`\`
install_extension({ id: "docker.io/sulla-ai/remotion:2026.02" })
\`\`\`

### 2. Create the project
\`\`\`
create_project({
  project_name: "<video-name>",
  content: "---\\ntitle: <Video Name>\\nstatus: active\\ntags: [video, remotion]\\n---\\n# <Video Name>\\n\\n<brief description>"
})
\`\`\`
This creates the project folder and PROJECT.md. The project directory path is returned in the response.

### 3. Scrape brand data (if featuring a product)
\`\`\`
exec({
  command: "curl -s -X POST 'https://api.firecrawl.dev/v1/scrape' -H 'Content-Type: application/json' -H 'Authorization: Bearer $FIRECRAWL_API_KEY' -d '{\\"url\\": \\"<product-url>\\", \\"formats\\": [\\"markdown\\", \\"extract\\", \\"screenshot\\"], \\"extract\\": {\\"schema\\": {\\"type\\": \\"object\\", \\"properties\\": {\\"brandName\\": {\\"type\\": \\"string\\"}, \\"tagline\\": {\\"type\\": \\"string\\"}, \\"headline\\": {\\"type\\": \\"string\\"}, \\"description\\": {\\"type\\": \\"string\\"}, \\"features\\": {\\"type\\": \\"array\\", \\"items\\": {\\"type\\": \\"string\\"}}, \\"logoUrl\\": {\\"type\\": \\"string\\"}, \\"faviconUrl\\": {\\"type\\": \\"string\\"}, \\"primaryColors\\": {\\"type\\": \\"array\\", \\"items\\": {\\"type\\": \\"string\\"}}, \\"ctaText\\": {\\"type\\": \\"string\\"}, \\"socialLinks\\": {\\"type\\": \\"object\\"}}}}}'"
})
\`\`\`
**MANDATORY** when a video mentions or features any product/company. Use the returned brand data (colors, logos, copy) to drive visual direction.

### 4. Create the video project inside the container
\`\`\`
exec({
  command: "docker exec sulla_remotion_studio mkdir -p /app/projects/<video-name>/src/scenes /app/projects/<video-name>/public/images/brand /app/projects/<video-name>/public/audio"
})
\`\`\`

### 5. Write project files
Write each source file into the container using heredoc via \`exec\`:
\`\`\`
exec({
  command: "docker exec sulla_remotion_studio sh -c \\"cat > /app/projects/<video-name>/src/Root.tsx << 'ENDOFFILE'\\nimport { Composition } from 'remotion';\\n...\\nENDOFFILE\\""
})
\`\`\`

Create these files:
- \`src/Root.tsx\` — Composition definitions
- \`src/index.ts\` — Entry point
- \`src/MyVideo.tsx\` — Main video component with scene sequences
- \`src/scenes/*.tsx\` — Individual scene components
- \`package.json\` — With remotion and lucide-react dependencies

### 6. Install dependencies inside the container
\`\`\`
exec({
  command: "docker exec sulla_remotion_studio sh -c 'cd /app/projects/<video-name> && npm install'",
  timeout: 120000
})
\`\`\`

### 7. Download brand assets (if scraped)
\`\`\`
exec({
  command: "docker exec sulla_remotion_studio sh -c 'curl -sL \\"<logo-url>\\" -o /app/projects/<video-name>/public/images/brand/logo.png && curl -sL \\"<screenshot-url>\\" -o /app/projects/<video-name>/public/images/brand/screenshot.png'"
})
\`\`\`

### 8. Show the preview to the user
\`\`\`
manage_active_asset({
  action: "upsert",
  assetType: "iframe",
  assetId: "remotion_studio",
  title: "<Video Name> — Remotion Studio",
  url: "http://localhost:30310",
  active: true
})
\`\`\`
Remotion Studio is already running on port 30310. The user can select the project from the Studio UI. Hot-reload works automatically when files change inside the container volume.

### 9. Iterate
User previews in Studio, requests changes. Edit source files via \`exec\` + \`docker exec\` heredocs. Studio hot-reloads.

### 10. Render (only when user explicitly asks to export)
\`\`\`
exec({
  command: "docker exec sulla_remotion_studio sh -c 'cd /app/projects/<video-name> && npx remotion render <CompositionName> /app/out/<video-name>.mp4'",
  timeout: 300000
})
\`\`\`
Rendered output lands in the \`remotion-output\` volume at \`/app/out/<video-name>.mp4\`.

---

## Core Architecture

### Scene Management
Use scene-based architecture with proper transitions:

\`\`\`tsx
const SCENE_DURATIONS: Record<string, number> = {
  intro: 3000,     // 3s hook
  problem: 4000,   // 4s dramatic
  solution: 3500,  // 3.5s reveal
  features: 5000,  // 5s showcase
  cta: 3000,       // 3s close
};
\`\`\`

### Video Structure Pattern
\`\`\`tsx
import {
  AbsoluteFill, Sequence, useCurrentFrame,
  useVideoConfig, interpolate, spring,
  Img, staticFile, Audio,
} from "remotion";

export const MyVideo = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill>
      {/* Background music */}
      <Audio src={staticFile("audio/bg-music.mp3")} volume={0.35} />

      {/* Persistent background layer - OUTSIDE sequences */}
      <AnimatedBackground frame={frame} />

      {/* Scene sequences */}
      <Sequence from={0} durationInFrames={90}>
        <IntroScene />
      </Sequence>
      <Sequence from={90} durationInFrames={120}>
        <FeatureScene />
      </Sequence>
    </AbsoluteFill>
  );
};
\`\`\`

## Motion Graphics Principles

### AVOID (Slideshow patterns)
- Fading to black between scenes
- Centered text on solid backgrounds
- Same transition for everything
- Linear/robotic animations
- Static screens
- \`slideLeft\`, \`slideRight\`, \`crossDissolve\`, \`fadeBlur\` presets
- Emoji icons — NEVER use emoji, always use Lucide React icons

### PURSUE (Motion graphics)
- Overlapping transitions (next starts BEFORE current ends)
- Layered compositions (background/midground/foreground)
- Spring physics for organic motion
- Varied timing (2-5s scenes, mixed rhythms)
- Continuous visual elements across scenes
- Custom transitions with clipPath, 3D transforms, morphs
- Lucide React for ALL icons (\`npm install lucide-react\`) — never emoji

## Transition Techniques
1. **Morph/Scale** - Element scales up to fill screen, becomes next scene's background
2. **Wipe** - Colored shape sweeps across, revealing next scene
3. **Zoom-through** - Camera pushes into element, emerges into new scene
4. **Clip-path reveal** - Circle/polygon grows from point to reveal
5. **Persistent anchor** - One element stays while surroundings change
6. **Directional flow** - Scene 1 exits right, Scene 2 enters from right
7. **Split/unfold** - Screen divides, panels slide apart
8. **Perspective flip** - Scene rotates on Y-axis in 3D

## Animation Timing Reference
\`\`\`tsx
// Timing values (in seconds)
const timing = {
  micro: 0.1-0.2,      // Small shifts, subtle feedback
  snappy: 0.2-0.4,     // Element entrances, position changes
  standard: 0.5-0.8,   // Scene transitions, major reveals
  dramatic: 1.0-1.5,   // Hero moments, cinematic reveals
};

// Spring configs
const springs = {
  snappy: { stiffness: 400, damping: 30 },
  bouncy: { stiffness: 300, damping: 15 },
  smooth: { stiffness: 120, damping: 25 },
};
\`\`\`

## Visual Style Guidelines

### Typography
- One display font + one body font max
- Massive headlines, tight tracking
- Mix weights for hierarchy
- Keep text SHORT (viewers can't pause)

### Colors
- **Use brand colors from Firecrawl scrape** as the primary palette — match the product's actual look
- **Avoid purple/indigo gradients** unless the brand uses them or the user explicitly requests them
- Simple, clean backgrounds are generally best — a single dark tone or subtle gradient beats layered textures
- Intentional accent colors pulled from the brand

### Layout
- Use asymmetric layouts, off-center type
- Edge-aligned elements create visual tension
- Generous whitespace as design element
- Use depth sparingly — a subtle backdrop blur or single gradient, not stacked textures

## Remotion Essentials

### Interpolation
\`\`\`tsx
const opacity = interpolate(frame, [0, 30], [0, 1], {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp"
});

const scale = spring({
  frame, fps,
  from: 0.8, to: 1,
  durationInFrames: 30,
  config: { damping: 12 }
});
\`\`\`

### Sequences with Overlap
\`\`\`tsx
<Sequence from={0} durationInFrames={100}>
  <Scene1 />
</Sequence>
<Sequence from={80} durationInFrames={100}>
  <Scene2 />
</Sequence>
\`\`\`

### Cross-Scene Continuity
Place persistent elements OUTSIDE Sequence blocks:

\`\`\`tsx
const PersistentShape = ({ currentScene }: { currentScene: number }) => {
  const positions = {
    0: { x: 100, y: 100, scale: 1, opacity: 0.3 },
    1: { x: 800, y: 200, scale: 2, opacity: 0.5 },
    2: { x: 400, y: 600, scale: 0.5, opacity: 1 },
  };

  return (
    <motion.div
      animate={positions[currentScene]}
      transition={{ duration: 0.8, ease: "easeInOut" }}
      className="absolute w-32 h-32 rounded-full bg-gradient-to-r from-coral to-orange"
    />
  );
};
\`\`\`

## Quality Tests
Before delivering, verify:

- **Mute test:** Story follows visually without sound?
- **Squint test:** Hierarchy visible when squinting?
- **Timing test:** Motion feels natural, not robotic?
- **Consistency test:** Similar elements behave similarly?
- **Slideshow test:** Does NOT look like PowerPoint?
- **Loop test:** Video loops smoothly back to start?

## Implementation Steps
1. **Ensure Remotion installed** — \`list_installed_extensions\`, then \`install_extension\` if missing
2. **Create project** — \`create_project\` (creates folder + PROJECT.md)
3. **Firecrawl brand scrape** — If featuring a product, \`exec\` curl to Firecrawl API
4. **Director's treatment** — Write vibe, camera style, emotional arc
5. **Visual direction** — Colors, fonts, brand feel, animation style
6. **Scene breakdown** — List every scene with description, duration, text, transitions
7. **Plan assets** — User assets + generated images/videos + brand scrape assets
8. **Define durations** — Vary pacing (2-3s punchy, 4-5s dramatic)
9. **Create project dirs in container** — \`exec\` docker exec mkdir -p
10. **Build persistent layer** — \`exec\` docker exec heredoc to write animated background
11. **Build scenes** — \`exec\` docker exec heredoc for each scene component
12. **Install deps in container** — \`exec\` docker exec npm install
13. **Open with hook** — High-impact first scene
14. **Develop narrative** — Content-driven middle scenes
15. **Strong ending** — Intentional, resolved close
16. **Show preview** — \`manage_active_asset\` opens Studio at \`http://localhost:30310\`
17. **Iterate** — \`exec\` docker exec heredoc edits, Studio hot-reloads
18. **Render** — \`exec\` docker exec npx remotion render (only when user asks)

## File Structure (inside container)
\`\`\`
/app/projects/<video-name>/
├── src/
│   ├── Root.tsx              # Composition definitions
│   ├── index.ts              # Entry point
│   ├── index.css             # Global styles
│   ├── MyVideo.tsx           # Main video component
│   └── scenes/               # Scene components (optional)
├── public/
│   ├── images/
│   │   └── brand/            # Firecrawl-scraped assets
│   └── audio/                # Background music
├── remotion.config.ts
└── package.json

/app/out/                     # Rendered video output
└── <video-name>.mp4
\`\`\`

## Common Components

### Animated Background
\`\`\`tsx
import { useCurrentFrame, interpolate } from "remotion";

export const AnimatedBackground = ({ frame }: { frame: number }) => {
  const hueShift = interpolate(frame, [0, 300], [0, 360]);
  const gradientAngle = interpolate(frame, [0, 300], [0, 180]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: \`linear-gradient(\${gradientAngle}deg,
          hsl(\${hueShift}, 70%, 15%),
          hsl(\${hueShift + 60}, 60%, 10%))\`,
      }}
    />
  );
};
\`\`\`

### Terminal Window
\`\`\`tsx
export const TerminalWindow = ({
  lines,
  frame,
  fps,
}: {
  lines: string[];
  frame: number;
  fps: number;
}) => {
  const visibleLines = Math.floor(frame / (fps * 0.3));

  return (
    <div className="bg-gray-900 rounded-xl p-6 font-mono text-sm shadow-2xl border border-gray-700">
      <div className="flex gap-2 mb-4">
        <div className="w-3 h-3 rounded-full bg-red-500" />
        <div className="w-3 h-3 rounded-full bg-yellow-500" />
        <div className="w-3 h-3 rounded-full bg-green-500" />
      </div>
      {lines.slice(0, visibleLines).map((line, i) => (
        <div key={i} className="text-green-400 leading-relaxed">
          <span className="text-gray-500">$ </span>{line}
        </div>
      ))}
      {visibleLines <= lines.length && (
        <span className="inline-block w-2 h-5 bg-green-400 animate-pulse" />
      )}
    </div>
  );
};
\`\`\`

### Feature Card
\`\`\`tsx
import { spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

// icon should be a Lucide React component, NEVER an emoji string
export const FeatureCard = ({
  icon: Icon,
  title,
  description,
  delay = 0,
}: {
  icon: React.FC<{ size?: number; color?: string }>;
  title: string;
  description: string;
  delay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: frame - delay,
    fps,
    config: { stiffness: 300, damping: 20 },
  });

  const opacity = interpolate(frame - delay, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{ transform: \`scale(\${scale})\`, opacity }}
      className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20"
    >
      <div className="mb-4"><Icon size={40} color="white" /></div>
      <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-300">{description}</p>
    </div>
  );
};
\`\`\`

### Stats Display
\`\`\`tsx
import { interpolate } from "remotion";

export const StatsDisplay = ({
  value,
  label,
  frame,
  fps,
}: {
  value: number;
  label: string;
  frame: number;
  fps: number;
}) => {
  const progress = interpolate(frame, [0, fps * 1.5], [0, 1], {
    extrapolateRight: "clamp",
  });
  const displayValue = Math.round(value * progress);

  return (
    <div className="text-center">
      <div className="text-7xl font-black text-white tracking-tight">
        {displayValue.toLocaleString()}
      </div>
      <div className="text-lg text-gray-400 uppercase tracking-widest mt-2">
        {label}
      </div>
    </div>
  );
};
\`\`\`

### CTA Button
\`\`\`tsx
import { spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export const CTAButton = ({
  text,
  frame,
  fps,
}: {
  text: string;
  frame: number;
  fps: number;
}) => {
  const scale = spring({
    frame,
    fps,
    config: { stiffness: 200, damping: 15 },
  });

  const shimmer = interpolate(frame, [0, fps * 2], [-100, 200]);

  return (
    <div
      style={{ transform: \`scale(\${scale})\` }}
      className="relative inline-block px-12 py-5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full text-white text-2xl font-bold overflow-hidden"
    >
      {text}
      <div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
        style={{ transform: \`translateX(\${shimmer}%)\` }}
      />
    </div>
  );
};
\`\`\`

### Text Reveal
\`\`\`tsx
import { interpolate } from "remotion";

export const TextReveal = ({
  text,
  frame,
  fps,
  charDelay = 2,
}: {
  text: string;
  frame: number;
  fps: number;
  charDelay?: number;
}) => {
  return (
    <div className="flex flex-wrap">
      {text.split("").map((char, i) => {
        const charFrame = frame - i * charDelay;
        const opacity = interpolate(charFrame, [0, 8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const y = interpolate(charFrame, [0, 8], [20, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <span
            key={i}
            style={{ opacity, transform: \`translateY(\${y}px)\` }}
            className="text-6xl font-bold text-white"
          >
            {char === " " ? "\\u00A0" : char}
          </span>
        );
      })}
    </div>
  );
};
\`\`\`

## Composition Patterns

### Basic Composition (Root.tsx)
\`\`\`tsx
import { Composition } from "remotion";
import { MyVideo } from "./MyVideo";

export const RemotionRoot = () => (
  <>
    <Composition
      id="MyVideo"
      component={MyVideo}
      durationInFrames={300}   // 10s at 30fps
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ title: "Hello World" }}
    />
  </>
);
\`\`\`

### Common Aspect Ratios
- **16:9 landscape (YouTube):** 1920x1080 or 1280x720
- **9:16 vertical (Reels/TikTok/Shorts):** 1080x1920
- **4:5 Instagram feed:** 1080x1350
- **1:1 square:** 1080x1080

### Key Remotion APIs
\`\`\`tsx
import {
  useCurrentFrame,      // Current frame number
  useVideoConfig,       // { fps, width, height, durationInFrames }
  interpolate,          // Map frame ranges to values
  spring,               // Physics-based spring animation
  Sequence,             // Time-offset children
  AbsoluteFill,         // Full-frame container
  Img,                  // Image component (preloads)
  Audio,                // Audio component
  Video,                // Video component
  staticFile,           // Reference files in public/
  delayRender,          // Hold render until async ready
  continueRender,       // Resume after delayRender
} from "remotion";
\`\`\`

### Fetching Data (delayRender)
\`\`\`tsx
const [data, setData] = useState(null);
const [handle] = useState(() => delayRender());

useEffect(() => {
  fetch("https://api.example.com/data")
    .then((r) => r.json())
    .then((d) => { setData(d); continueRender(handle); });
}, []);
\`\`\`

### TailwindCSS
Remotion supports Tailwind out of the box when scaffolded with \`--tailwind\`. Use className as normal on any element.
`;
  },
};

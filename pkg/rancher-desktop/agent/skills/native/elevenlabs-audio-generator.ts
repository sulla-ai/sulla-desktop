import type { NativeSkillDefinition } from './NativeSkillRegistry';

export const elevenlabsAudioGeneratorSkill: NativeSkillDefinition = {
  name: 'elevenlabs-audio-generator',
  description: 'Generate music, sound effects, and voice clips via ElevenLabs API with a web-based preview player. Triggers on "generate music", "make me some songs", "background music", "sound effects", "music for video", "audio tracks", "ElevenLabs music", "voice generation", "text to speech".',
  tags: ['audio', 'music', 'sound-effects', 'voice', 'elevenlabs', 'tts', 'text-to-speech', 'mp3', 'sfx'],
  version: '1.0',
  async func(_input) {
    return `# ElevenLabs Audio Generator

Generate music, sound effects, and voice clips via ElevenLabs, preview in a grouped browser player.

---

## Tool Mapping

| Step | Tool | Notes |
|------|------|-------|
| Create project | \`create_project\` | Creates the project folder + PROJECT.md (also creates the directory). Use the returned project directory path as \`cwd\`. |
| Create audio subdirectories | \`exec\` | \`mkdir -p music sfx voice\` in the project directory |
| Generate music/SFX | \`exec\` | curl to ElevenLabs sound-generation API |
| Generate voice clips | \`exec\` | curl to ElevenLabs text-to-speech API |
| Build HTML player | \`fs_write_file\` | Write a self-contained HTML player file into the project directory |
| Serve the player | \`exec\` | \`python3 -m http.server\` in the project directory |
| Show preview to user | \`manage_active_asset\` | Opens player as an iframe sidebar asset |

---

## Setup

\`ELEVENLABS_API_KEY\` must be available. Check via:
\`\`\`
exec({ command: "echo $ELEVENLABS_API_KEY | head -c4" })
\`\`\`
If not set, ask the user to configure it in their environment or integration settings.

---

## Default Workflow (ALWAYS follow this)

### 1. Create the project
\`\`\`
create_project({
  project_name: "<audio-project-name>",
  content: "---\\ntitle: <Audio Project Name>\\nstatus: active\\ntags: [audio, elevenlabs]\\n---\\n# <Audio Project Name>\\n\\n<brief description>"
})
\`\`\`
The response returns the project directory path. Use it as \`cwd\` for all subsequent \`exec\` calls.

### 2. Create audio directories
\`\`\`
exec({
  command: "mkdir -p music sfx voice",
  cwd: "<project-dir>"
})
\`\`\`

### 3. Generate audio tracks
Generate in parallel using \`&\` and \`wait\` for speed.

#### Music
\`\`\`
exec({
  command: "SAFE_NAME=$(echo '<prompt>' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | head -c 60) && curl -s -w '%{http_code}' -X POST 'https://api.elevenlabs.io/v1/sound-generation' -H 'xi-api-key: '$ELEVENLABS_API_KEY -H 'Content-Type: application/json' -d '{\\\"text\\\": \\\"<prompt>\\\", \\\"duration_seconds\\\": <duration>, \\\"prompt_influence\\\": <influence>}' -o music/\\$SAFE_NAME-$(date +%s).mp3",
  cwd: "<project-dir>"
})
\`\`\`
- \`duration_seconds\`: 0.5 to 30 (optional — omit the field and the API guesses)
- \`prompt_influence\`: 0 to 1, default 0.3 (higher = closer to prompt)
- Be specific: genre, mood, tempo, instruments, "no vocals"

#### Sound Effects
Same API endpoint, same curl pattern — just target the \`sfx/\` directory and describe sounds:
\`\`\`
exec({
  command: "SAFE_NAME=$(echo '<prompt>' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | head -c 60) && curl -s -X POST 'https://api.elevenlabs.io/v1/sound-generation' -H 'xi-api-key: '$ELEVENLABS_API_KEY -H 'Content-Type: application/json' -d '{\\\"text\\\": \\\"<prompt>\\\", \\\"prompt_influence\\\": 0.5}' -o sfx/\\$SAFE_NAME-$(date +%s).mp3",
  cwd: "<project-dir>"
})
\`\`\`
Good for: whooshes, clicks, ambient, UI sounds, impacts

#### Voice
\`\`\`
exec({
  command: "SAFE_NAME=$(echo '<text>' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | head -c 60) && curl -s -X POST 'https://api.elevenlabs.io/v1/text-to-speech/<voice_id>' -H 'xi-api-key: '$ELEVENLABS_API_KEY -H 'Content-Type: application/json' -d '{\\\"text\\\": \\\"<text>\\\", \\\"model_id\\\": \\\"eleven_flash_v2_5\\\"}' -o voice/\\$SAFE_NAME-$(date +%s).mp3",
  cwd: "<project-dir>"
})
\`\`\`
- Default voice: Sarah (EXAVITQu4vr4xnSDxMaL)
- Default model: eleven_flash_v2_5
- Common voices: Roger (CwhRBWXzGAHq8TQ4Fs17), Charlie (IKne3meq5aSn9XLyUdCD), George (JBFqnCBsd6RMkjVDRZzb), River (SAz9YHcvj6GT2YYXdXww)

#### Parallel generation example
\`\`\`
exec({
  command: "SAFE1='upbeat-lofi-hip-hop' && SAFE2='whoosh-transition' && SAFE3='welcome-to-the-future' && (curl -s -X POST 'https://api.elevenlabs.io/v1/sound-generation' -H 'xi-api-key: '$ELEVENLABS_API_KEY -H 'Content-Type: application/json' -d '{\\\"text\\\": \\\"Upbeat electronic lo-fi hip hop, 90 bpm, no vocals\\\", \\\"duration_seconds\\\": 15, \\\"prompt_influence\\\": 0.4}' -o music/\\$SAFE1-$(date +%s).mp3 &) && (curl -s -X POST 'https://api.elevenlabs.io/v1/sound-generation' -H 'xi-api-key: '$ELEVENLABS_API_KEY -H 'Content-Type: application/json' -d '{\\\"text\\\": \\\"Whoosh transition cinematic\\\", \\\"prompt_influence\\\": 0.5}' -o sfx/\\$SAFE2-$(date +%s).mp3 &) && (curl -s -X POST 'https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL' -H 'xi-api-key: '$ELEVENLABS_API_KEY -H 'Content-Type: application/json' -d '{\\\"text\\\": \\\"Welcome to the future of AI\\\", \\\"model_id\\\": \\\"eleven_flash_v2_5\\\"}' -o voice/\\$SAFE3-$(date +%s).mp3 &) && wait && echo 'All tracks generated'",
  cwd: "<project-dir>",
  timeout: 60000
})
\`\`\`

### 4. Build the HTML player
Use \`fs_write_file\` to create a self-contained HTML player at \`<project-dir>/player.html\`.

The player should:
- Group tracks by category with color-coded sections: music (green), sfx (yellow), voice (blue)
- Include inline CSS/JS for play/pause, progress bar, and track name display
- Be fully self-contained (no external dependencies)

First, use \`exec\` to list the generated files:
\`\`\`
exec({
  command: "find music sfx voice -name '*.mp3' 2>/dev/null | sort",
  cwd: "<project-dir>"
})
\`\`\`

Then use \`fs_write_file\` to write the player HTML with the discovered file paths embedded.

### 5. Serve the player
\`\`\`
exec({
  command: "nohup python3 -m http.server 8080 > /dev/null 2>&1 &",
  cwd: "<project-dir>"
})
\`\`\`

### 6. Show the preview to the user
\`\`\`
manage_active_asset({
  action: "upsert",
  assetType: "iframe",
  assetId: "elevenlabs_<audio-project-name>",
  title: "<Audio Project Name> — Audio Player",
  url: "http://localhost:8080/player.html",
  active: true
})
\`\`\`
This opens the audio player in the user's sidebar. They can preview tracks and request more or changes.

### 7. Iterate
User listens, picks favorites, asks for more tracks or adjustments. Generate additional tracks with \`exec\`, rebuild the player with \`fs_write_file\`, and the sidebar refreshes.

---

## Directory Structure
\`\`\`
<project-dir>/
├── music/*.mp3     (green accent in player)
├── sfx/*.mp3       (yellow accent in player)
├── voice/*.mp3     (blue accent in player)
└── player.html     (self-contained audio preview player)
\`\`\`

## Tips
- Be specific with music prompts: include genre, mood, tempo, instruments, and "no vocals" if needed
- Generate tracks in parallel using \`&\` and \`wait\` to speed up batch generation
- Use prompt_influence between 0.3-0.5 for a good balance of creativity and adherence to your description
- Organize outputs into music/, sfx/, and voice/ subdirs so the player auto-categorizes them
- Sound effects work best with short, descriptive prompts like "whoosh transition" or "UI click subtle"
- Duration is optional — the API will guess an appropriate length if you omit it
- Voice IDs like Sarah, Roger, Charlie are presets — test a few to find the right tone for your project
`;
  },
};

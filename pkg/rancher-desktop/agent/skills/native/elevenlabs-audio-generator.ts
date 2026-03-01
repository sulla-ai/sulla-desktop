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
| Verify ElevenLabs integration | \`integration_is_enabled\` | Ensure the \`elevenlabs\` integration is connected before generation |
| Read ElevenLabs credentials | \`integration_get_credentials\` | Fetch \`api_key\` from integration credentials (not shell env vars) |
| Create project | \`create_project\` | Creates the project folder + PROJECT.md (also creates the directory). Use the returned project directory path as \`cwd\`. |
| Create audio subdirectories | \`exec\` | \`mkdir -p music sfx voice\` in the project directory |
| Generate music/SFX | \`exec\` | curl to ElevenLabs sound-generation API |
| Generate voice clips | \`exec\` | curl to ElevenLabs text-to-speech API |
| Present audio to user | \`send_channel_message\` | Send markdown audio links — the chat UI renders inline audio players automatically |

---

## Setup

Use integration tools (not shell env vars) to get ElevenLabs credentials:
\`\`\`
integration_is_enabled({ integration_slug: "elevenlabs" })
integration_get_credentials({ integration_slug: "elevenlabs", include_secrets: true })
\`\`\`
Read \`api_key\` from the integration credentials and use that value in all ElevenLabs API requests.

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
  command: "SAFE_NAME=$(echo '<prompt>' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | head -c 60) && curl -s -w '%{http_code}' -X POST 'https://api.elevenlabs.io/v1/sound-generation' -H 'xi-api-key: <elevenlabs_api_key_from_integration>' -H 'Content-Type: application/json' -d '{\\\"text\\\": \\\"<prompt>\\\", \\\"duration_seconds\\\": <duration>, \\\"prompt_influence\\\": <influence>}' -o music/\\$SAFE_NAME-$(date +%s).mp3",
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
  command: "SAFE_NAME=$(echo '<prompt>' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | head -c 60) && curl -s -X POST 'https://api.elevenlabs.io/v1/sound-generation' -H 'xi-api-key: <elevenlabs_api_key_from_integration>' -H 'Content-Type: application/json' -d '{\\\"text\\\": \\\"<prompt>\\\", \\\"prompt_influence\\\": 0.5}' -o sfx/\\$SAFE_NAME-$(date +%s).mp3",
  cwd: "<project-dir>"
})
\`\`\`
Good for: whooshes, clicks, ambient, UI sounds, impacts

#### Voice
\`\`\`
exec({
  command: "SAFE_NAME=$(echo '<text>' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | head -c 60) && curl -s -X POST 'https://api.elevenlabs.io/v1/text-to-speech/<voice_id>' -H 'xi-api-key: <elevenlabs_api_key_from_integration>' -H 'Content-Type: application/json' -d '{\\\"text\\\": \\\"<text>\\\", \\\"model_id\\\": \\\"eleven_flash_v2_5\\\"}' -o voice/\\$SAFE_NAME-$(date +%s).mp3",
  cwd: "<project-dir>"
})
\`\`\`
- Default voice: Sarah (EXAVITQu4vr4xnSDxMaL)
- Default model: eleven_flash_v2_5
- Common voices: Roger (CwhRBWXzGAHq8TQ4Fs17), Charlie (IKne3meq5aSn9XLyUdCD), George (JBFqnCBsd6RMkjVDRZzb), River (SAz9YHcvj6GT2YYXdXww)

#### Parallel generation example
\`\`\`
exec({
  command: "SAFE1='upbeat-lofi-hip-hop' && SAFE2='whoosh-transition' && SAFE3='welcome-to-the-future' && (curl -s -X POST 'https://api.elevenlabs.io/v1/sound-generation' -H 'xi-api-key: <elevenlabs_api_key_from_integration>' -H 'Content-Type: application/json' -d '{\\\"text\\\": \\\"Upbeat electronic lo-fi hip hop, 90 bpm, no vocals\\\", \\\"duration_seconds\\\": 15, \\\"prompt_influence\\\": 0.4}' -o music/\\$SAFE1-$(date +%s).mp3 &) && (curl -s -X POST 'https://api.elevenlabs.io/v1/sound-generation' -H 'xi-api-key: <elevenlabs_api_key_from_integration>' -H 'Content-Type: application/json' -d '{\\\"text\\\": \\\"Whoosh transition cinematic\\\", \\\"prompt_influence\\\": 0.5}' -o sfx/\\$SAFE2-$(date +%s).mp3 &) && (curl -s -X POST 'https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL' -H 'xi-api-key: <elevenlabs_api_key_from_integration>' -H 'Content-Type: application/json' -d '{\\\"text\\\": \\\"Welcome to the future of AI\\\", \\\"model_id\\\": \\\"eleven_flash_v2_5\\\"}' -o voice/\\$SAFE3-$(date +%s).mp3 &) && wait && echo 'All tracks generated'",
  cwd: "<project-dir>",
  timeout: 60000
})
\`\`\`

### 4. Present audio to the user
Send a message with markdown links to the generated audio files. The chat UI automatically renders inline audio players for any link ending in an audio extension (.mp3, .wav, .ogg, .flac, .m4a, .aac, .webm).

First, list the generated files:
\`\`\`
exec({
  command: "find music sfx voice -name '*.mp3' 2>/dev/null | sort",
  cwd: "<project-dir>"
})
\`\`\`

Then send a message with the audio files as markdown links:
\`\`\`
send_channel_message({
  message: "Here are your generated tracks:\\n\\n**Music**\\n- [Upbeat Lo-Fi Hip Hop](file://<project-dir>/music/upbeat-lofi-hip-hop-1234.mp3)\\n\\n**Sound Effects**\\n- [Whoosh Transition](file://<project-dir>/sfx/whoosh-transition-1234.mp3)\\n\\n**Voice**\\n- [Welcome to the Future](file://<project-dir>/voice/welcome-to-the-future-1234.mp3)"
})
\`\`\`

Each audio link renders as an inline player with play/pause controls directly in the chat.

### 5. Iterate
User listens, picks favorites, asks for more tracks or adjustments. Generate additional tracks with \`exec\` and send new audio links via \`send_channel_message\`.

---

## Directory Structure
\`\`\`
<project-dir>/
├── music/*.mp3
├── sfx/*.mp3
└── voice/*.mp3
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
